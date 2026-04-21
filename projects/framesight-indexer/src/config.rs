use anyhow::Result;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Config {
    #[serde(default = "default_database_url")]
    pub database_url: String,
    
    #[serde(default = "default_chains")]
    pub chains: Vec<ChainConfig>,
    
    #[serde(default = "default_mode")]
    pub mode: IndexerMode,
    
    #[serde(default = "default_backfill_start_block")]
    pub backfill_start_block: u64,
    
    #[serde(default = "default_api_enabled")]
    pub api_enabled: bool,
    
    #[serde(default = "default_api_bind_address")]
    pub api_bind_address: String,
    
    #[serde(default = "default_max_concurrent_blocks")]
    pub max_concurrent_blocks: usize,
    
    #[serde(default = "default_block_batch_size")]
    pub block_batch_size: usize,
    
    #[serde(default = "default_reorg_safety_blocks")]
    pub reorg_safety_blocks: u64,
    
    #[serde(default = "default_kafka_brokers")]
    pub kafka_brokers: Option<String>,
    
    #[serde(default = "default_kafka_topic")]
    pub kafka_topic: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: String,
    pub rpc_url: String,
    pub ws_url: Option<String>,
    pub entrypoint_v060: String,
    pub entrypoint_v070: String,
    pub start_block: u64,
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum IndexerMode {
    Realtime,
    Backfill,
    Hybrid,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();
        
        let mut config_builder = config::Config::builder()
            .add_source(config::Environment::with_prefix("INDEXER"));
        
        // Try to load from file if exists
        if std::path::Path::new("config.yaml").exists() {
            config_builder = config_builder.add_source(config::File::with_name("config"));
        }
        
        let config = config_builder.build()?;
        Ok(config.try_deserialize()?)
    }
    
    pub fn get_chain(&self, chain_id: u64) -> Option<&ChainConfig> {
        self.chains.iter().find(|c| c.chain_id == chain_id)
    }
}

fn default_database_url() -> String {
    "postgres://localhost:5432/framesight".to_string()
}

fn default_chains() -> Vec<ChainConfig> {
    vec![
        ChainConfig {
            chain_id: 1,
            name: "ethereum".to_string(),
            rpc_url: "https://eth-mainnet.g.alchemy.com/v2/demo".to_string(),
            ws_url: None,
            entrypoint_v060: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".to_string(),
            entrypoint_v070: "0x0000000071727De22E5E9d8BAf0edAc6f37da032".to_string(),
            start_block: 17344420, // EntryPoint v0.6.0 deployment
        },
        ChainConfig {
            chain_id: 137,
            name: "polygon".to_string(),
            rpc_url: "https://polygon-mainnet.g.alchemy.com/v2/demo".to_string(),
            ws_url: None,
            entrypoint_v060: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".to_string(),
            entrypoint_v070: "0x0000000071727De22E5E9d8BAf0edAc6f37da032".to_string(),
            start_block: 41386998,
        },
        ChainConfig {
            chain_id: 10,
            name: "optimism".to_string(),
            rpc_url: "https://opt-mainnet.g.alchemy.com/v2/demo".to_string(),
            ws_url: None,
            entrypoint_v060: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".to_string(),
            entrypoint_v070: "0x0000000071727De22E5E9d8BAf0edAc6f37da032".to_string(),
            start_block: 94531480,
        },
        ChainConfig {
            chain_id: 42161,
            name: "arbitrum".to_string(),
            rpc_url: "https://arb-mainnet.g.alchemy.com/v2/demo".to_string(),
            ws_url: None,
            entrypoint_v060: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".to_string(),
            entrypoint_v070: "0x0000000071727De22E5E9d8BAf0edAc6f37da032".to_string(),
            start_block: 87334593,
        },
        ChainConfig {
            chain_id: 8453,
            name: "base".to_string(),
            rpc_url: "https://base-mainnet.g.alchemy.com/v2/demo".to_string(),
            ws_url: None,
            entrypoint_v060: "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789".to_string(),
            entrypoint_v070: "0x0000000071727De22E5E9d8BAf0edAc6f37da032".to_string(),
            start_block: 3980519,
        },
    ]
}

fn default_mode() -> IndexerMode {
    IndexerMode::Hybrid
}

fn default_backfill_start_block() -> u64 {
    0
}

fn default_api_enabled() -> bool {
    true
}

fn default_api_bind_address() -> String {
    "0.0.0.0:8080".to_string()
}

fn default_max_concurrent_blocks() -> usize {
    10
}

fn default_block_batch_size() -> usize {
    100
}

fn default_reorg_safety_blocks() -> u64 {
    12
}

fn default_kafka_brokers() -> Option<String> {
    None
}

fn default_kafka_topic() -> Option<String> {
    None
}
