use ethers::prelude::*;
use std::sync::Arc;

// EntryPoint v0.6.0 Contract Addresses
pub const ENTRYPOINT_V060_MAINNET: &str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
pub const ENTRYPOINT_V060_POLYGON: &str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
pub const ENTRYPOINT_V060_OPTIMISM: &str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
pub const ENTRYPOINT_V060_ARBITRUM: &str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";
pub const ENTRYPOINT_V060_BASE: &str = "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789";

// EntryPoint v0.7.0 Contract Addresses
pub const ENTRYPOINT_V070_MAINNET: &str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
pub const ENTRYPOINT_V070_POLYGON: &str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
pub const ENTRYPOINT_V070_OPTIMISM: &str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
pub const ENTRYPOINT_V070_ARBITRUM: &str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";
pub const ENTRYPOINT_V070_BASE: &str = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

// EntryPoint v0.6.0 ABI (simplified)
pub const ENTRYPOINT_V060_ABI: &str = r#"[
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "paymaster", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "nonce", "type": "uint256"},
            {"indexed": false, "internalType": "bool", "name": "success", "type": "bool"},
            {"indexed": false, "internalType": "uint256", "name": "actualGasCost", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "actualGasUsed", "type": "uint256"}
        ],
        "name": "UserOperationEvent",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
            {"indexed": false, "internalType": "address", "name": "factory", "type": "address"},
            {"indexed": false, "internalType": "address", "name": "paymaster", "type": "address"}
        ],
        "name": "AccountDeployed",
        "type": "event"
    }
]"#;

// EntryPoint v0.7.0 ABI (simplified) - similar structure
pub const ENTRYPOINT_V070_ABI: &str = r#"[
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
            {"indexed": true, "internalType": "address", "name": "paymaster", "type": "address"},
            {"indexed": false, "internalType": "uint256", "name": "nonce", "type": "uint256"},
            {"indexed": false, "internalType": "bytes", "name": "success", "type": "bytes"},
            {"indexed": false, "internalType": "uint256", "name": "actualGasCost", "type": "uint256"},
            {"indexed": false, "internalType": "uint256", "name": "actualGasUsed", "type": "uint256"}
        ],
        "name": "UserOperationEvent",
        "type": "event"
    },
    {
        "anonymous": false,
        "inputs": [
            {"indexed": true, "internalType": "bytes32", "name": "userOpHash", "type": "bytes32"},
            {"indexed": true, "internalType": "address", "name": "sender", "type": "address"},
            {"indexed": false, "internalType": "address", "name": "factory", "type": "address"},
            {"indexed": false, "internalType": "address", "name": "paymaster", "type": "address"}
        ],
        "name": "AccountDeployed",
        "type": "event"
    }
]"#;

#[derive(Debug, Clone)]
pub struct EntryPointContract<M: Middleware> {
    contract: Contract<M>,
    version: EntryPointVersion,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum EntryPointVersion {
    V060,
    V070,
}

impl std::fmt::Display for EntryPointVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            EntryPointVersion::V060 => write!(f, "v0.6.0"),
            EntryPointVersion::V070 => write!(f, "v0.7.0"),
        }
    }
}

impl<M: Middleware> EntryPointContract<M> {
    pub fn new(address: Address, client: Arc<M>, version: EntryPointVersion) -> Self {
        let abi = match version {
            EntryPointVersion::V060 => ENTRYPOINT_V060_ABI,
            EntryPointVersion::V070 => ENTRYPOINT_V070_ABI,
        };
        
        let contract = Contract::new(address, serde_json::from_str(abi).unwrap(), client);
        
        Self { contract, version }
    }

    pub fn version(&self) -> EntryPointVersion {
        self.version
    }

    pub fn address(&self) -> Address {
        self.contract.address()
    }

    pub fn contract(&self) -> &Contract<M> {
        &self.contract
    }
}

pub fn get_entrypoint_address(chain_id: u64, version: EntryPointVersion) -> Option<Address> {
    let addr_str = match (chain_id, version) {
        (1, EntryPointVersion::V060) => ENTRYPOINT_V060_MAINNET,
        (1, EntryPointVersion::V070) => ENTRYPOINT_V070_MAINNET,
        (137, EntryPointVersion::V060) => ENTRYPOINT_V060_POLYGON,
        (137, EntryPointVersion::V070) => ENTRYPOINT_V070_POLYGON,
        (10, EntryPointVersion::V060) => ENTRYPOINT_V060_OPTIMISM,
        (10, EntryPointVersion::V070) => ENTRYPOINT_V070_OPTIMISM,
        (42161, EntryPointVersion::V060) => ENTRYPOINT_V060_ARBITRUM,
        (42161, EntryPointVersion::V070) => ENTRYPOINT_V070_ARBITRUM,
        (8453, EntryPointVersion::V060) => ENTRYPOINT_V060_BASE,
        (8453, EntryPointVersion::V070) => ENTRYPOINT_V070_BASE,
        _ => return None,
    };
    
    addr_str.parse().ok()
}

pub fn get_entrypoint_deployment_block(chain_id: u64, version: EntryPointVersion) -> u64 {
    match (chain_id, version) {
        (1, EntryPointVersion::V060) => 17344420,
        (1, EntryPointVersion::V070) => 19213,
        (137, EntryPointVersion::V060) => 41386998,
        (137, EntryPointVersion::V070) => 48858181,
        (10, EntryPointVersion::V060) => 94531480,
        (10, EntryPointVersion::V070) => 111644756,
        (42161, EntryPointVersion::V060) => 87334593,
        (42161, EntryPointVersion::V070) => 149273653,
        (8453, EntryPointVersion::V060) => 3980519,
        (8453, EntryPointVersion::V070) => 14576911,
        _ => 0,
    }
}
