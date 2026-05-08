-- FrameSight TimescaleDB Schema Migration
-- Phase 1: Core Schema Creation

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- CORE TABLES (Non-hypertable - reference data)
-- ============================================================================

-- AI Models registry
CREATE TABLE IF NOT EXISTS ai_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(100) NOT NULL UNIQUE,
    provider VARCHAR(50) NOT NULL,
    version VARCHAR(20),
    capabilities JSONB,
    cost_per_1k_tokens DECIMAL(10, 6),
    context_window INTEGER,
    embedding_dimensions INTEGER DEFAULT 1536,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Data sources (blockchains, APIs, etc.)
CREATE TABLE IF NOT EXISTS data_sources (
    id SERIAL PRIMARY KEY,
    source_name VARCHAR(100) NOT NULL UNIQUE,
    source_type VARCHAR(50) NOT NULL, -- 'blockchain', 'api', 'webhook'
    network VARCHAR(50), -- 'mainnet', 'polygon', etc. for blockchains
    rpc_endpoint VARCHAR(500),
    api_endpoint VARCHAR(500),
    auth_config JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert configurations
CREATE TABLE IF NOT EXISTS alert_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(200) NOT NULL,
    description TEXT,
    condition_type VARCHAR(50) NOT NULL, -- 'threshold', 'anomaly', 'pattern'
    condition_config JSONB NOT NULL,
    severity VARCHAR(20) DEFAULT 'info', -- 'critical', 'warning', 'info'
    notification_channels JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TIME-SERIES TABLES (Hypertables)
-- ============================================================================

-- Agent execution logs
CREATE TABLE IF NOT EXISTS agent_executions (
    id BIGSERIAL,
    agent_id VARCHAR(100) NOT NULL,
    execution_type VARCHAR(50) NOT NULL, -- 'analysis', 'prediction', 'alert'
    model_id INTEGER REFERENCES ai_models(id),
    input_tokens INTEGER,
    output_tokens INTEGER,
    execution_time_ms INTEGER,
    cost_usd DECIMAL(10, 6),
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed'
    error_message TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Convert to hypertable
SELECT create_hypertable('agent_executions', 'created_at', if_not_exists => TRUE);

-- Create indexes
CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id, created_at DESC);
CREATE INDEX idx_agent_executions_status ON agent_executions(status, created_at DESC);

-- Blockchain event data (raw events from The Graph/web3)
CREATE TABLE IF NOT EXISTS blockchain_events (
    id BIGSERIAL,
    source_id INTEGER REFERENCES data_sources(id),
    event_type VARCHAR(100) NOT NULL, -- 'Transfer', 'Swap', 'Stake', etc.
    transaction_hash VARCHAR(66),
    block_number BIGINT NOT NULL,
    block_hash VARCHAR(66),
    contract_address VARCHAR(42),
    from_address VARCHAR(42),
    to_address VARCHAR(42),
    value NUMERIC(78, 0), -- Handle large ETH values
    gas_used BIGINT,
    gas_price NUMERIC(78, 0),
    event_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('blockchain_events', 'created_at', if_not_exists => TRUE);

CREATE INDEX idx_blockchain_events_source ON blockchain_events(source_id, created_at DESC);
CREATE INDEX idx_blockchain_events_type ON blockchain_events(event_type, created_at DESC);
CREATE INDEX idx_blockchain_events_contract ON blockchain_events(contract_address, created_at DESC);
CREATE INDEX idx_blockchain_events_block ON blockchain_events(block_number);

-- Market data (prices, volumes, liquidity)
CREATE TABLE IF NOT EXISTS market_data (
    id BIGSERIAL,
    source_id INTEGER REFERENCES data_sources(id),
    pair_symbol VARCHAR(50) NOT NULL, -- 'ETH/USDC', 'BTC/USDT'
    price DECIMAL(30, 10) NOT NULL,
    volume_24h DECIMAL(30, 10),
    liquidity_usd DECIMAL(30, 2),
    bid DECIMAL(30, 10),
    ask DECIMAL(30, 10),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('market_data', 'created_at', if_not_exists => TRUE, chunk_time_interval => INTERVAL '1 hour');

CREATE INDEX idx_market_data_pair ON market_data(pair_symbol, created_at DESC);
CREATE INDEX idx_market_data_source ON market_data(source_id, created_at DESC);

-- AI predictions and analysis results
CREATE TABLE IF NOT EXISTS ai_analysis (
    id BIGSERIAL,
    execution_id BIGINT REFERENCES agent_executions(id),
    analysis_type VARCHAR(50) NOT NULL, -- 'sentiment', 'price_prediction', 'anomaly_detection'
    target_asset VARCHAR(50),
    confidence_score DECIMAL(5, 4), -- 0.0000 to 1.0000
    prediction_value DECIMAL(30, 10),
    prediction_horizon INTERVAL, -- how far ahead
    reasoning TEXT,
    raw_output TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('ai_analysis', 'created_at', if_not_exists => TRUE);

CREATE INDEX idx_ai_analysis_type ON ai_analysis(analysis_type, created_at DESC);
CREATE INDEX idx_ai_analysis_asset ON ai_analysis(target_asset, created_at DESC);
CREATE INDEX idx_ai_analysis_execution ON ai_analysis(execution_id);

-- ============================================================================
-- VECTOR STORAGE (for embeddings and semantic search)
-- ============================================================================

-- Document embeddings for RAG (Retrieval Augmented Generation)
CREATE TABLE IF NOT EXISTS document_embeddings (
    id BIGSERIAL,
    document_type VARCHAR(50) NOT NULL, -- 'whitepaper', 'news', 'tweet', 'discord_msg'
    source_url TEXT,
    content_hash VARCHAR(64) UNIQUE, -- SHA-256 of content
    content_text TEXT,
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('document_embeddings', 'created_at', if_not_exists => TRUE);

-- Create IVFFlat index for vector similarity search
CREATE INDEX idx_document_embeddings_vector ON document_embeddings 
    USING ivfflat (embedding vector_cosine_ops) 
    WITH (lists = 100);

CREATE INDEX idx_document_embeddings_type ON document_embeddings(document_type, created_at DESC);

-- Semantic search function
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding VECTOR(1536),
    doc_type VARCHAR(50) DEFAULT NULL,
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 5
)
RETURNS TABLE(
    id BIGINT,
    document_type VARCHAR(50),
    content_text TEXT,
    similarity FLOAT,
    metadata JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.document_type,
        de.content_text,
        1 - (de.embedding <=> query_embedding) AS similarity,
        de.metadata
    FROM document_embeddings de
    WHERE (doc_type IS NULL OR de.document_type = doc_type)
        AND 1 - (de.embedding <=> query_embedding) > match_threshold
    ORDER BY de.embedding <=> query_embedding
    LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CONTINUOUS AGGREGATES (for fast analytics)
-- ============================================================================

-- Hourly market data aggregates
CREATE MATERIALIZED VIEW market_data_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', created_at) AS bucket,
    source_id,
    pair_symbol,
    AVG(price) AS avg_price,
    MAX(price) AS max_price,
    MIN(price) AS min_price,
    FIRST(price, created_at) AS open_price,
    LAST(price, created_at) AS close_price,
    AVG(volume_24h) AS avg_volume,
    AVG(liquidity_usd) AS avg_liquidity
FROM market_data
GROUP BY bucket, source_id, pair_symbol;

-- Add retention policies
SELECT add_retention_policy('agent_executions', INTERVAL '90 days');
SELECT add_retention_policy('blockchain_events', INTERVAL '1 year');
SELECT add_retention_policy('market_data', INTERVAL '90 days');
SELECT add_retention_policy('ai_analysis', INTERVAL '1 year');
SELECT add_retention_policy('document_embeddings', INTERVAL '180 days');

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_ai_models_updated_at BEFORE UPDATE ON ai_models
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_alert_rules_updated_at BEFORE UPDATE ON alert_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
