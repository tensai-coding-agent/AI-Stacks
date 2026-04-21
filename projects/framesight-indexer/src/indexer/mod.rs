use anyhow::Result;
use ethers::prelude::*;
use futures::stream::{self, StreamExt};
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock, Notify};
use tracing::{info, warn, error, debug};
use chrono::Utc;

use crate::config::{Config, ChainConfig, IndexerMode};
use crate::db::Database;
use crate::events::{UserOperationEvent, AccountDeployedEvent, Event, BlockData};
use crate::contracts::{EntryPointContract, EntryPointVersion, get_entrypoint_address};

pub struct Indexer {
    config: Config,
    db: Arc<Database>,
    chains: Vec<ChainIndexer>,
    shutdown: Arc<Notify>,
}

struct ChainIndexer {
    chain_id: u64,
    chain_config: ChainConfig,
    providers: Arc<RwLock<ChainProviders>>,
    db: Arc<Database>,
    shutdown: Arc<Notify>,
}

struct ChainProviders {
    http: Arc<Provider<Http>>,
    ws: Option<Arc<Provider<Ws>>>,
}

impl Indexer {
    pub async fn new(config: Config, db: Arc<Database>) -> Result<Self> {
        let shutdown = Arc::new(Notify::new());
        let mut chains = Vec::new();

        for chain_config in &config.chains {
            let chain_indexer = ChainIndexer::new(
                chain_config.clone(),
                db.clone(),
                shutdown.clone(),
            ).await?;
            
            chains.push(chain_indexer);
        }

        info!("Indexer initialized with {} chain(s)", chains.len());

        Ok(Self {
            config,
            db,
            chains,
            shutdown,
        })
    }

    pub async fn run(&self) -> Result<()> {
        info!("Starting indexer in {:?} mode", self.config.mode);

        let mut handles = Vec::new();

        for chain in &self.chains {
            let chain_clone = chain.clone();
            let mode = self.config.mode.clone();
            let handle = tokio::spawn(async move {
                if let Err(e) = chain_clone.run(mode).await {
                    error!("Chain indexer error: {}", e);
                }
            });
            handles.push(handle);
        }

        // Wait for all chain indexers
        for handle in handles {
            let _ = handle.await;
        }

        Ok(())
    }

    pub async fn shutdown(&self) -> Result<()> {
        info!("Initiating graceful shutdown...");
        self.shutdown.notify_waiters();
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
        Ok(())
    }
}

impl ChainIndexer {
    async fn new(
        chain_config: ChainConfig,
        db: Arc<Database>,
        shutdown: Arc<Notify>,
    ) -> Result<Self> {
        // Initialize HTTP provider
        let http_provider = Arc::new(Provider::<Http>::try_from(&chain_config.rpc_url)?);
        
        // Initialize WebSocket provider if available
        let ws_provider = if let Some(ws_url) = &chain_config.ws_url {
            match Provider::<Ws>::connect(ws_url).await {
                Ok(provider) => {
                    info!("WebSocket connected for chain {}", chain_config.chain_id);
                    Some(Arc::new(provider))
                }
                Err(e) => {
                    warn!("Failed to connect WebSocket for chain {}: {}", chain_config.chain_id, e);
                    None
                }
            }
        } else {
            None
        };

        let providers = Arc::new(RwLock::new(ChainProviders {
            http: http_provider,
            ws: ws_provider,
        }));

        Ok(Self {
            chain_id: chain_config.chain_id,
            chain_config,
            providers,
            db,
            shutdown,
        })
    }

    async fn run(&self, mode: IndexerMode) -> Result<()> {
        info!(
            "Starting chain indexer for {} (chain_id: {})",
            self.chain_config.name,
            self.chain_id
        );

        match mode {
            IndexerMode::Realtime => self.run_realtime().await,
            IndexerMode::Backfill => self.run_backfill().await,
            IndexerMode::Hybrid => self.run_hybrid().await,
        }
    }

    async fn run_realtime(&self) -> Result<()> {
        info!("Running in realtime mode for chain {}", self.chain_id);

        // Get the last indexed block
        let start_block = self.db.get_last_indexed_block(self.chain_id).await?
            .unwrap_or(self.chain_config.start_block);

        // Initialize EntryPoint contracts
        let v060_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V060);
        let v070_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V070);

        let providers = self.providers.read().await;
        let http = providers.http.clone();
        drop(providers);

        // Create filter for events from both EntryPoint versions
        let mut addresses = Vec::new();
        if let Some(addr) = v060_address {
            addresses.push(addr);
        }
        if let Some(addr) = v070_address {
            addresses.push(addr);
        }

        let filter = Filter::new()
            .address(addresses)
            .from_block(start_block);

        // Subscribe to new blocks
        let block_stream = http.watch_blocks().await?;
        let mut block_stream = block_stream.stream();

        info!("Subscribed to new blocks for chain {}", self.chain_id);

        loop {
            tokio::select! {
                Some(block_hash) = block_stream.next() => {
                    if let Err(e) = self.process_block(block_hash).await {
                        error!("Error processing block {:?}: {}", block_hash, e);
                    }
                }
                _ = self.shutdown.notified() => {
                    info!("Realtime indexer shutting down for chain {}", self.chain_id);
                    break;
                }
            }
        }

        Ok(())
    }

    async fn run_backfill(&self) -> Result<()> {
        info!("Running in backfill mode for chain {}", self.chain_id);

        // Get the last indexed block or use configured start
        let start_block = self.db.get_last_indexed_block(self.chain_id).await?
            .unwrap_or(self.chain_config.start_block);

        // Get current block
        let providers = self.providers.read().await;
        let current_block = providers.http.get_block_number().await?;
        drop(providers);

        info!(
            "Backfilling chain {} from block {} to {}",
            self.chain_id,
            start_block,
            current_block
        );

        // Process blocks in batches
        let batch_size = 100usize;
        let mut from_block = start_block;

        while from_block <= current_block.as_u64() {
            let to_block = std::cmp::min(from_block + batch_size as u64 - 1, current_block.as_u64());

            if let Err(e) = self.process_block_range(from_block, to_block).await {
                error!("Error processing block range {}-{}: {}", from_block, to_block, e);
                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                continue;
            }

            // Update progress
            self.db.update_indexing_progress(self.chain_id, to_block).await?;

            from_block = to_block + 1;

            // Check for shutdown signal
            if tokio::time::timeout(
                tokio::time::Duration::from_millis(10),
                self.shutdown.notified()
            ).await.is_ok() {
                info!("Backfill interrupted for chain {}", self.chain_id);
                break;
            }
        }

        info!("Backfill completed for chain {}", self.chain_id);
        Ok(())
    }

    async fn run_hybrid(&self) -> Result<()> {
        info!("Running in hybrid mode for chain {}", self.chain_id);

        // First, run backfill to catch up
        self.run_backfill().await?;

        // Then switch to realtime mode
        self.run_realtime().await
    }

    async fn process_block(&self, block_hash: H256) -> Result<()> {
        let providers = self.providers.read().await;
        let block = providers.http.get_block(block_hash).await?;
        drop(providers);

        if let Some(block) = block {
            let block_number = block.number.unwrap_or_default().as_u64();
            debug!("Processing block {} on chain {}", block_number, self.chain_id);

            // Get all logs for this block from EntryPoint contracts
            let v060_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V060);
            let v070_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V070);

            let mut addresses = Vec::new();
            if let Some(addr) = v060_address {
                addresses.push(addr);
            }
            if let Some(addr) = v070_address {
                addresses.push(addr);
            }

            let filter = Filter::new()
                .address(addresses)
                .at_block_hash(block_hash);

            let providers = self.providers.read().await;
            let logs = providers.http.get_logs(&filter).await?;
            drop(providers);

            // Process each log
            for (idx, log) in logs.iter().enumerate() {
                if let Err(e) = self.process_log(&block, idx as u64, log).await {
                    error!("Error processing log: {}", e);
                }
            }

            // Update indexing progress
            self.db.update_indexing_progress(self.chain_id, block_number).await?;
        }

        Ok(())
    }

    async fn process_block_range(&self, from_block: u64, to_block: u64) -> Result<()> {
        let v060_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V060);
        let v070_address = get_entrypoint_address(self.chain_id, EntryPointVersion::V070);

        let mut addresses = Vec::new();
        if let Some(addr) = v060_address {
            addresses.push(addr);
        }
        if let Some(addr) = v070_address {
            addresses.push(addr);
        }

        let filter = Filter::new()
            .address(addresses)
            .from_block(from_block)
            .to_block(to_block);

        let providers = self.providers.read().await;
        let logs = providers.http.get_logs(&filter).await?;
        drop(providers);

        debug!(
            "Processing block range {}-{} on chain {}: {} logs",
            from_block,
            to_block,
            self.chain_id,
            logs.len()
        );

        for log in &logs {
            // Get block info for timestamp
            let providers = self.providers.read().await;
            let block = providers.http.get_block(log.block_hash.unwrap()).await?;
            drop(providers);

            if let Some(block) = block {
                if let Err(e) = self.process_log(&block, log.log_index.unwrap_or_default().as_u64(), log).await {
                    error!("Error processing log: {}", e);
                }
            }
        }

        Ok(())
    }

    async fn process_log(
        &self,
        block: &Block<H256>,
        log_index: u64,
        log: &Log,
    ) -> Result<()> {
        use ethers::contract::parse_log;

        let topics = &log.topics;
        if topics.is_empty() {
            return Ok(());
        }

        let event_signature = topics[0];
        let timestamp = Utc::now(); // Use current time as fallback

        // UserOperationEvent signature: keccak256("UserOperationEvent(bytes32,address,address,uint256,bool,uint256,uint256)")
        const USER_OP_EVENT_SIG: &str = "0x49628fd1471006c1482da88028e9ce4dbb080b815c7b454337dafa6e0000010";
        // AccountDeployed signature: keccak256("AccountDeployed(bytes32,address,address,address)")
        const ACCOUNT_DEPLOYED_SIG: &str = "0x5d0c046f39db957c96f2a22e0e2456b3aa0a22ecaf015c2d5b3db55e9000001";

        let entrypoint_version = if log.address == get_entrypoint_address(self.chain_id, EntryPointVersion::V060).unwrap_or_default() {
            "v0.6.0"
        } else {
            "v0.7.0"
        };

        let event_sig_hex = format!("{:?}", event_signature).to_lowercase();

        if event_sig_hex == USER_OP_EVENT_SIG {
            // Parse UserOperationEvent
            let user_op_hash = format!("{:?}", topics.get(1).unwrap_or(&H256::zero()));
            let sender = format!("{:?}", Address::from(topics.get(2).copied().unwrap_or_default()));
            let paymaster = topics.get(3).map(|t| format!("{:?}", Address::from(*t)));

            let event = UserOperationEvent {
                timestamp,
                chain_id: self.chain_id,
                block_number: block.number.unwrap_or_default().as_u64(),
                block_hash: format!("{:?}", block.hash.unwrap_or_default()),
                tx_hash: format!("{:?}", log.transaction_hash.unwrap_or_default()),
                log_index,
                entrypoint_version: entrypoint_version.to_string(),
                entrypoint_address: format!("{:?}", log.address),
                user_op_hash,
                sender,
                paymaster,
                nonce: None, // Would need to decode data
                success: None,
                actual_gas_cost: None,
                actual_gas_used: None,
                intent_type: None,
                intent_confidence: None,
            };

            self.db.save_user_operation(&event).await?;
            debug!("Saved UserOperationEvent: {}", event.user_op_hash);
        } else if event_sig_hex == ACCOUNT_DEPLOYED_SIG {
            // Parse AccountDeployed event
            let user_op_hash = format!("{:?}", topics.get(1).unwrap_or(&H256::zero()));
            let sender = format!("{:?}", Address::from(topics.get(2).copied().unwrap_or_default()));

            let event = AccountDeployedEvent {
                timestamp,
                chain_id: self.chain_id,
                block_number: block.number.unwrap_or_default().as_u64(),
                block_hash: format!("{:?}", block.hash.unwrap_or_default()),
                tx_hash: format!("{:?}", log.transaction_hash.unwrap_or_default()),
                log_index,
                entrypoint_version: entrypoint_version.to_string(),
                entrypoint_address: format!("{:?}", log.address),
                user_op_hash,
                sender,
                factory: None, // Would need to decode data
                paymaster: None,
            };

            self.db.save_account_deployed(&event).await?;
            debug!("Saved AccountDeployed: {}", event.user_op_hash);
        }

        Ok(())
    }
}

impl Clone for ChainIndexer {
    fn clone(&self) -> Self {
        Self {
            chain_id: self.chain_id,
            chain_config: self.chain_config.clone(),
            providers: self.providers.clone(),
            db: self.db.clone(),
            shutdown: self.shutdown.clone(),
        }
    }
}
