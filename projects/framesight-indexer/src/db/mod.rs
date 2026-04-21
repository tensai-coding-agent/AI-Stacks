use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::{postgres::PgPoolOptions, Pool, Postgres, Row};
use std::sync::Arc;
use tracing::{info, debug, error};

use crate::events::{UserOperationEvent, AccountDeployedEvent, PaymasterEvent};

pub struct Database {
    pool: Pool<Postgres>,
}

impl Database {
    pub async fn new(database_url: &str) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(20)
            .min_connections(5)
            .acquire_timeout(std::time::Duration::from_secs(30))
            .idle_timeout(std::time::Duration::from_secs(600))
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    pub async fn run_migrations(&self) -> Result<()> {
        info!("Running database migrations...");
        
        sqlx::query(
            r#"
            -- Enable TimescaleDB extension
            CREATE EXTENSION IF NOT EXISTS timescaledb;

            -- UserOperation events table (hypertable)
            CREATE TABLE IF NOT EXISTS user_operations (
                id BIGSERIAL,
                time TIMESTAMPTZ NOT NULL,
                chain_id BIGINT NOT NULL,
                block_number BIGINT NOT NULL,
                block_hash TEXT NOT NULL,
                tx_hash TEXT NOT NULL,
                log_index INTEGER NOT NULL,
                entrypoint_version TEXT NOT NULL,
                entrypoint_address TEXT NOT NULL,
                user_op_hash TEXT NOT NULL,
                sender TEXT NOT NULL,
                paymaster TEXT,
                nonce NUMERIC,
                success BOOLEAN,
                actual_gas_cost NUMERIC,
                actual_gas_used NUMERIC,
                intent_type TEXT,
                intent_confidence FLOAT,
                PRIMARY KEY (time, id)
            );

            -- Convert to hypertable if not already
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM timescaledb_information.hypertables 
                    WHERE hypertable_name = 'user_operations'
                ) THEN
                    PERFORM create_hypertable('user_operations', 'time');
                END IF;
            END $$;

            -- AccountDeployed events table (hypertable)
            CREATE TABLE IF NOT EXISTS account_deployed (
                id BIGSERIAL,
                time TIMESTAMPTZ NOT NULL,
                chain_id BIGINT NOT NULL,
                block_number BIGINT NOT NULL,
                block_hash TEXT NOT NULL,
                tx_hash TEXT NOT NULL,
                log_index INTEGER NOT NULL,
                entrypoint_version TEXT NOT NULL,
                entrypoint_address TEXT NOT NULL,
                user_op_hash TEXT NOT NULL,
                sender TEXT NOT NULL,
                factory TEXT,
                paymaster TEXT,
                PRIMARY KEY (time, id)
            );

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM timescaledb_information.hypertables 
                    WHERE hypertable_name = 'account_deployed'
                ) THEN
                    PERFORM create_hypertable('account_deployed', 'time');
                END IF;
            END $$;

            -- Paymaster events table (hypertable)
            CREATE TABLE IF NOT EXISTS paymaster_events (
                id BIGSERIAL,
                time TIMESTAMPTZ NOT NULL,
                chain_id BIGINT NOT NULL,
                block_number BIGINT NOT NULL,
                block_hash TEXT NOT NULL,
                tx_hash TEXT NOT NULL,
                log_index INTEGER NOT NULL,
                paymaster_address TEXT NOT NULL,
                event_type TEXT NOT NULL,
                user_op_hash TEXT,
                token_address TEXT,
                amount NUMERIC,
                PRIMARY KEY (time, id)
            );

            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM timescaledb_information.hypertables 
                    WHERE hypertable_name = 'paymaster_events'
                ) THEN
                    PERFORM create_hypertable('paymaster_events', 'time');
                END IF;
            END $$;

            -- Indexing progress tracking
            CREATE TABLE IF NOT EXISTS indexing_progress (
                chain_id BIGINT PRIMARY KEY,
                last_indexed_block BIGINT NOT NULL,
                last_indexed_time TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            -- Bundler statistics (continuous aggregate)
            CREATE TABLE IF NOT EXISTS bundler_stats (
                time TIMESTAMPTZ NOT NULL,
                chain_id BIGINT NOT NULL,
                bundler_address TEXT NOT NULL,
                user_op_count BIGINT NOT NULL,
                total_gas_used NUMERIC,
                PRIMARY KEY (time, chain_id, bundler_address)
            );

            -- Paymaster usage statistics (continuous aggregate)
            CREATE TABLE IF NOT EXISTS paymaster_stats (
                time TIMESTAMPTZ NOT NULL,
                chain_id BIGINT NOT NULL,
                paymaster_address TEXT NOT NULL,
                user_op_count BIGINT NOT NULL,
                total_sponsored NUMERIC,
                PRIMARY KEY (time, chain_id, paymaster_address)
            );

            -- Intent classification results
            CREATE TABLE IF NOT EXISTS intent_classifications (
                id BIGSERIAL PRIMARY KEY,
                user_op_hash TEXT NOT NULL UNIQUE,
                intent_type TEXT NOT NULL,
                confidence FLOAT NOT NULL,
                calldata_pattern TEXT,
                decoded_params JSONB,
                classified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            -- Create indexes for better query performance
            CREATE INDEX IF NOT EXISTS idx_user_ops_hash ON user_operations(user_op_hash);
            CREATE INDEX IF NOT EXISTS idx_user_ops_sender ON user_operations(sender);
            CREATE INDEX IF NOT EXISTS idx_user_ops_paymaster ON user_operations(paymaster);
            CREATE INDEX IF NOT EXISTS idx_user_ops_chain_time ON user_operations(chain_id, time DESC);
            CREATE INDEX IF NOT EXISTS idx_user_ops_intent ON user_operations(intent_type, time DESC);
            
            CREATE INDEX IF NOT EXISTS idx_account_deployed_hash ON account_deployed(user_op_hash);
            CREATE INDEX IF NOT EXISTS idx_account_deployed_sender ON account_deployed(sender);
            CREATE INDEX IF NOT EXISTS idx_account_deployed_factory ON account_deployed(factory);
            
            CREATE INDEX IF NOT EXISTS idx_paymaster_events_address ON paymaster_events(paymaster_address);
            CREATE INDEX IF NOT EXISTS idx_paymaster_events_type ON paymaster_events(event_type);
            CREATE INDEX IF NOT EXISTS idx_intent_classifications_hash ON intent_classifications(user_op_hash);
            CREATE INDEX IF NOT EXISTS idx_intent_classifications_type ON intent_classifications(intent_type);
            "#
        )
        .execute(&self.pool)
        .await?;

        info!("Database migrations completed successfully");
        Ok(())
    }

    pub async fn save_user_operation(&self, event: &UserOperationEvent) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO user_operations (
                time, chain_id, block_number, block_hash, tx_hash, log_index,
                entrypoint_version, entrypoint_address, user_op_hash, sender,
                paymaster, nonce, success, actual_gas_cost, actual_gas_used,
                intent_type, intent_confidence
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT DO NOTHING
            "#
        )
        .bind(event.timestamp)
        .bind(event.chain_id as i64)
        .bind(event.block_number as i64)
        .bind(&event.block_hash)
        .bind(&event.tx_hash)
        .bind(event.log_index as i32)
        .bind(&event.entrypoint_version)
        .bind(&event.entrypoint_address)
        .bind(&event.user_op_hash)
        .bind(&event.sender)
        .bind(&event.paymaster)
        .bind(event.nonce.map(|n| n as i64))
        .bind(event.success)
        .bind(event.actual_gas_cost.map(|g| g as i64))
        .bind(event.actual_gas_used.map(|g| g as i64))
        .bind(&event.intent_type)
        .bind(event.intent_confidence)
        .execute(&self.pool)
        .await?;

        debug!("Saved UserOperation: {}", event.user_op_hash);
        Ok(())
    }

    pub async fn save_account_deployed(&self, event: &AccountDeployedEvent) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO account_deployed (
                time, chain_id, block_number, block_hash, tx_hash, log_index,
                entrypoint_version, entrypoint_address, user_op_hash, sender,
                factory, paymaster
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT DO NOTHING
            "#
        )
        .bind(event.timestamp)
        .bind(event.chain_id as i64)
        .bind(event.block_number as i64)
        .bind(&event.block_hash)
        .bind(&event.tx_hash)
        .bind(event.log_index as i32)
        .bind(&event.entrypoint_version)
        .bind(&event.entrypoint_address)
        .bind(&event.user_op_hash)
        .bind(&event.sender)
        .bind(&event.factory)
        .bind(&event.paymaster)
        .execute(&self.pool)
        .await?;

        debug!("Saved AccountDeployed: {}", event.user_op_hash);
        Ok(())
    }

    pub async fn save_paymaster_event(&self, event: &PaymasterEvent) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO paymaster_events (
                time, chain_id, block_number, block_hash, tx_hash, log_index,
                paymaster_address, event_type, user_op_hash, token_address, amount
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT DO NOTHING
            "#
        )
        .bind(event.timestamp)
        .bind(event.chain_id as i64)
        .bind(event.block_number as i64)
        .bind(&event.block_hash)
        .bind(&event.tx_hash)
        .bind(event.log_index as i32)
        .bind(&event.paymaster_address)
        .bind(&event.event_type)
        .bind(&event.user_op_hash)
        .bind(&event.token_address)
        .bind(event.amount.map(|a| a as i64))
        .execute(&self.pool)
        .await?;

        debug!("Saved PaymasterEvent: {:?}", event.event_type);
        Ok(())
    }

    pub async fn update_indexing_progress(
        &self,
        chain_id: u64,
        block_number: u64,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO indexing_progress (chain_id, last_indexed_block, last_indexed_time, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            ON CONFLICT (chain_id)
            DO UPDATE SET
                last_indexed_block = EXCLUDED.last_indexed_block,
                last_indexed_time = EXCLUDED.last_indexed_time,
                updated_at = EXCLUDED.updated_at
            "#
        )
        .bind(chain_id as i64)
        .bind(block_number as i64)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_last_indexed_block(&self, chain_id: u64) -> Result<Option<u64>> {
        let row = sqlx::query(
            "SELECT last_indexed_block FROM indexing_progress WHERE chain_id = $1"
        )
        .bind(chain_id as i64)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| r.get::<i64, _>(0) as u64))
    }

    pub async fn save_intent_classification(
        &self,
        user_op_hash: &str,
        intent_type: &str,
        confidence: f32,
        calldata_pattern: Option<&str>,
        decoded_params: Option<serde_json::Value>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO intent_classifications (
                user_op_hash, intent_type, confidence, calldata_pattern, decoded_params
            ) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_op_hash)
            DO UPDATE SET
                intent_type = EXCLUDED.intent_type,
                confidence = EXCLUDED.confidence,
                calldata_pattern = EXCLUDED.calldata_pattern,
                decoded_params = EXCLUDED.decoded_params,
                classified_at = NOW()
            "#
        )
        .bind(user_op_hash)
        .bind(intent_type)
        .bind(confidence)
        .bind(calldata_pattern)
        .bind(decoded_params)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub fn pool(&self) -> &Pool<Postgres> {
        &self.pool
    }
}
