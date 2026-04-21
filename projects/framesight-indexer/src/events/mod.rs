use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserOperationEvent {
    pub timestamp: DateTime<Utc>,
    pub chain_id: u64,
    pub block_number: u64,
    pub block_hash: String,
    pub tx_hash: String,
    pub log_index: u64,
    pub entrypoint_version: String,
    pub entrypoint_address: String,
    pub user_op_hash: String,
    pub sender: String,
    pub paymaster: Option<String>,
    pub nonce: Option<u64>,
    pub success: Option<bool>,
    pub actual_gas_cost: Option<u64>,
    pub actual_gas_used: Option<u64>,
    pub intent_type: Option<String>,
    pub intent_confidence: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDeployedEvent {
    pub timestamp: DateTime<Utc>,
    pub chain_id: u64,
    pub block_number: u64,
    pub block_hash: String,
    pub tx_hash: String,
    pub log_index: u64,
    pub entrypoint_version: String,
    pub entrypoint_address: String,
    pub user_op_hash: String,
    pub sender: String,
    pub factory: Option<String>,
    pub paymaster: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaymasterEvent {
    pub timestamp: DateTime<Utc>,
    pub chain_id: u64,
    pub block_number: u64,
    pub block_hash: String,
    pub tx_hash: String,
    pub log_index: u64,
    pub paymaster_address: String,
    pub event_type: PaymasterEventType,
    pub user_op_hash: Option<String>,
    pub token_address: Option<String>,
    pub amount: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PaymasterEventType {
    UserOperationSponsored,
    TokensWithdrawn,
    GasBalanceUpdated,
    Other,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentClassification {
    pub user_op_hash: String,
    pub intent_type: IntentType,
    pub confidence: f32,
    pub calldata_pattern: Option<String>,
    pub decoded_params: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentType {
    TokenTransfer,
    NftTransfer,
    Swap,
    Bridge,
    Stake,
    Unstake,
    Claim,
    GovernanceVote,
    ContractDeploy,
    Multicall,
    Unknown,
}

impl IntentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            IntentType::TokenTransfer => "token_transfer",
            IntentType::NftTransfer => "nft_transfer",
            IntentType::Swap => "swap",
            IntentType::Bridge => "bridge",
            IntentType::Stake => "stake",
            IntentType::Unstake => "unstake",
            IntentType::Claim => "claim",
            IntentType::GovernanceVote => "governance_vote",
            IntentType::ContractDeploy => "contract_deploy",
            IntentType::Multicall => "multicall",
            IntentType::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockData {
    pub chain_id: u64,
    pub block_number: u64,
    pub block_hash: String,
    pub timestamp: DateTime<Utc>,
    pub events: Vec<Event>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Event {
    UserOperation(UserOperationEvent),
    AccountDeployed(AccountDeployedEvent),
    Paymaster(PaymasterEvent),
}
