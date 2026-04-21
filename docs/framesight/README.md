# FrameSight Technical Architecture

## Executive Summary

FrameSight is Tensai's modular indexing platform for Ethereum and Layer 2 analytics. It transforms raw blockchain data into actionable insights through an intent-centric pipeline powered by AI classification and real-time anomaly detection.

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Data Flow Architecture](#data-flow-architecture)
4. [AI Integration](#ai-integration)
5. [Scaling Strategy](#scaling-strategy)
6. [Security Architecture](#security-architecture)
7. [Integration Points](#integration-points)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FrameSight Platform                         │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │   Web App    │  │   API GW     │  │  Admin Panel │  (Presentation)│
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
└─────────┼─────────────────┼─────────────────┼────────────────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │
┌───────────────────────────┼─────────────────────────────────────────┐
│                      Query Layer                                    │
│  ┌────────────────────────┼────────────────────┐  ┌──────────────┐  │
│  │   GraphQL API          │                  │  │  REST API    │  │
│  │   (The Graph / Custom) │                  │  │  (Admin)     │  │
│  └───────────┬────────────┼──────────────────┘  └──────┬───────┘  │
└──────────────┼───────────┼────────────────────────────┼───────────┘
               │           │                            │
               └───────────┼────────────────────────────┘
                           │
┌──────────────────────────┼─────────────────────────────────────────┐
│                   Indexing Engine                                   │
│  ┌───────────────────────┼─────────────┐  ┌──────────────────────┐  │
│  │   Event Listeners     │             │  │   Intent Processor   │  │
│  │   (Multi-chain)       │             │  │   (AI-powered)       │  │
│  └───────────┬───────────┼─────────────┘  └──────────┬─────────────┘  │
│              │           │                          │                │
│  ┌───────────┴───────────┴───────────┐  ┌──────────┴──────────────┐  │
│  │        Data Pipeline            │  │    ML Pipeline         │  │
│  │  - Real-time streaming          │  │  - Intent classification│  │
│  │  - Batch processing             │  │  - Anomaly detection   │  │
│  │  - Data transformation          │  │  - Predictive models   │  │
│  └───────────┬───────────────────────┘  └──────────┬──────────────┘  │
└──────────────┼────────────────────────────────────┼───────────────┘
               │                                    │
┌──────────────┼────────────────────────────────────┼───────────────┐
│         Storage Layer                                              │
│  ┌───────────┴───────────┐  ┌────────────────────┴───────────┐    │
│  │  Time-series DB       │  │  Vector DB                     │    │
│  │  (TimescaleDB)        │  │  (pgvector / Pinecone)         │    │
│  │  - Block data         │  │  - Semantic embeddings         │    │
│  │  - Transaction events │  │  - Similarity search           │    │
│  └───────────────────────┘  └─────────────────────────────────┘    │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   Cache Layer (Redis)                          │  │
│  │   - Hot query cache                                           │  │
│  │   - Session state                                             │  │
│  │   - Rate limiting                                             │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Blockchain Layer                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ Ethereum │  │  Arbitrum│  │ Optimism │  │  Base    │  ...     │
│  │  Mainnet │  │   One    │  │          │  │          │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Modularity**: Each component is independently deployable and scalable
2. **Intent-Centric**: Focus on user intents rather than raw transaction data
3. **Real-time + Batch**: Hybrid processing for different use cases
4. **AI-Native**: ML pipelines integrated at core, not bolted-on
5. **Multi-chain**: First-class support for Ethereum and major L2s

---

## Core Components

### 1. Indexing Engine

The indexing engine is the heart of FrameSight, responsible for ingesting blockchain data and transforming it into queryable formats.

#### Architecture Decision
See [ADR-001: Indexing Engine Selection](./adrs/ADR-001-indexing-engine.md)

**Hybrid Approach:**
- **The Graph Protocol** for standard ERC events and common DeFi protocols
- **Custom Indexers** for:
  - ERC-8141 Account Abstraction entry points
  - Intent-specific event patterns
  - Proprietary protocol integrations

#### Component Structure

```
packages/
├── indexing/
│   ├── graph-node/           # The Graph subgraphs
│   │   ├── subgraphs/
│   │   │   ├── erc20/
│   │   │   ├── erc721/
│   │   │   ├── defi/
│   │   │   └── account-abstraction/
│   │   └── docker-compose.yml
│   ├── custom-indexer/       # Rust-based custom indexer
│   │   ├── src/
│   │   │   ├── listeners/
│   │   │   ├── transformers/
│   │   │   └── db/
│   │   └── Cargo.toml
│   └── shared/
│       ├── types/
│       └── constants/
```

### 2. ERC-8141 Account Abstraction Integration

FrameSight provides deep analytics on ERC-8141 (ERC-4337) Account Abstraction, tracking:

- **EntryPoint interactions** across chains
- **Paymaster usage patterns**
- **Bundler market share**
- **Smart account deployments**
- **UserOperation flows**

#### Data Model

```typescript
interface UserOperation {
  hash: string;
  sender: string;           // Smart account address
  nonce: bigint;
  callData: string;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymaster?: string;
  paymasterData?: string;
  signature: string;
  
  // Enriched fields
  chainId: number;
  blockNumber: number;
  blockTimestamp: Date;
  actualGasCost: bigint;
  actualGasUsed: bigint;
  success: boolean;
  revertReason?: string;
}
```

### 3. Intent-Centric Analytics Pipeline

FrameSight's differentiator is intent classification — understanding *what* users are trying to accomplish.

#### Intent Taxonomy

| Category | Intents | Examples |
|----------|---------|----------|
| DeFi | swap, lend, borrow, stake, unstake, claim | "Swap 1000 USDC for ETH on Uniswap" |
| NFT | mint, buy, sell, transfer, list, bid | "Buy BAYC #1234 on OpenSea" |
| Social | follow, post, tip, collect | "Tip 0.1 ETH to @vitalik" |
| Governance | vote, propose, delegate | "Vote FOR proposal #42 on DAO" |
| Bridge | deposit, withdraw, send | "Bridge 500 USDC from Ethereum to Arbitrum" |

#### Intent Detection Pipeline

```
Raw Transaction
      │
      ▼
┌─────────────────┐
│  Pre-filtering  │ ──► Filter: value, contract type, method sig
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Feature Extract│ ──► Extract: token amounts, addresses, calldata
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  ML Classifier  │ ──► Intent classification model
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Post-process   │ ──► Confidence scoring, entity linking
└────────┬────────┘
         │
         ▼
   Intent Record
```

---

## Data Flow Architecture

### Real-Time Streaming

For time-sensitive analytics (live dashboards, alerts):

```
Blockchain RPC
     │
     ▼
Event Listener (WebSocket/IPC)
     │
     ▼
Message Queue (Kafka/RabbitMQ)
     │
     ├──────────┬──────────┐
     ▼          ▼          ▼
Hot Cache   Stream   Alert Engine
(Redis)   Processor   (Notifications)
     │          │
     ▼          ▼
   WebSocket   TimescaleDB
   Clients   (Time-series)
```

### Batch Processing

For historical analysis, aggregations, and ML training:

```
Blockchain RPC
     │
     ▼
Block Range Scanner
     │
     ▼
Data Lake (Parquet on S3)
     │
     ▼
Spark/dbt Jobs
     │
     ├──────────┬──────────┐
     ▼          ▼          ▼
Analytics   ML Training   Reports
 Tables     Features      Warehouse
```

### Data Retention Strategy

| Data Type | Hot Storage (7d) | Warm Storage (90d) | Cold Archive |
|-----------|------------------|-------------------|--------------|
| Raw blocks | Redis | TimescaleDB | S3 Glacier |
| Enriched events | Redis | TimescaleDB | S3 Standard |
| Intent records | TimescaleDB | TimescaleDB | S3 Standard |
| Aggregations | TimescaleDB | Data Warehouse | S3 Standard |
| ML embeddings | Vector DB | Vector DB | S3 Standard |

---

## AI Integration

### ML Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ML Platform                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐    ┌───────────────┐    ┌──────────────┐ │
│  │ Feature Store │───►│ Training Jobs │───►│ Model Registry│ │
│  │  (Feast)      │    │  (SageMaker)  │    │  (MLflow)     │ │
│  └───────────────┘    └───────────────┘    └───────┬──────┘ │
│                                                   │         │
│  ┌───────────────┐    ┌───────────────┐          │         │
│  │  Inference    │◄───│ Model Serving │◄─────────┘         │
│  │  (Real-time)  │    │  (SageMaker)  │                    │
│  └───────┬───────┘    └───────────────┘                    │
│          │                                                 │
│          ▼                                                 │
│  ┌───────────────┐                                         │
│  │  Feedback Loop│◄── User corrections, on-chain results   │
│  │  (Active Learning)                                     │
│  └───────────────┘                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Intent Classification Model

**Architecture:** Fine-tuned LLM (Llama 3 8B or similar) + classifier head

**Training Data:**
- Historical labeled transactions
- DeFi protocol documentation
- Community corrections

**Inference Pattern:**
```python
class IntentClassifier:
    def predict(self, transaction: Transaction) -> IntentPrediction:
        features = self.extract_features(transaction)
        embedding = self.encoder(features)
        intent_probs = self.classifier(embedding)
        return IntentPrediction(
            primary_intent=argmax(intent_probs),
            confidence=max(intent_probs),
            alternatives=top_k(intent_probs, k=3),
            entities=self.extract_entities(transaction)
        )
```

### Anomaly Detection

**Unsupervised clustering** + **threshold-based alerts**:

- **Volume Anomalies**: Unusual transaction volume from addresses
- **Price Anomalies**: DEX price deviations from oracles
- **Behavioral Anomalies**: New interaction patterns
- **Security Anomalies**: Known exploit patterns

---

## Scaling Strategy

### Horizontal Scaling

```
┌──────────────────────────────────────────────────────────────┐
│                     Load Balancer                            │
└──────────────────┬───────────────────────────────────────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐         ┌──────▼──────┐
│  API Pod 1  │         │  API Pod N  │
│  (Query)    │         │  (Query)    │
└──────┬──────┘         └──────┬──────┘
       │                       │
       └───────────┬───────────┘
                   │
       ┌───────────┴───────────┐
       │                       │
┌──────▼──────┐         ┌──────▼──────┐
│ Indexer 1   │         │ Indexer N   │
│ (Shard:     │         │ (Shard:     │
│  Chain A-C) │         │  Chain D-Z) │
└─────────────┘         └─────────────┘
```

### Database Sharding

- **By Chain**: Each L2 has dedicated read replicas
- **By Time**: Partition tables by week/month for efficient pruning
- **By Address Hash**: Distribute high-volume addresses across shards

### Caching Strategy

| Cache Type | Key Pattern | TTL | Use Case |
|------------|-------------|-----|----------|
| Query Result | `qr:{hash}` | 60s | Repeated API calls |
| Hot Addresses | `addr:{addr}:summary` | 300s | Wallet dashboards |
| Protocol Stats | `protocol:{id}:stats` | 600s | TVL, volume metrics |
| User Sessions | `session:{id}` | 24h | Auth, preferences |

---

## Security Architecture

### Data Access Control

- **Row-level security** in TimescaleDB based on API key permissions
- **Field-level filtering** for sensitive data (private transactions)
- **Rate limiting** per API key tier

### API Security

```
Client Request
     │
     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Rate Limiter│───►│ Auth Service│───►│ API Gateway  │
│  (Redis)    │    │  (JWT)        │    │              │
└──────────────┘    └──────────────┘    └──────┬───────┘
                                               │
                                               ▼
                                        ┌──────────────┐
                                        │ Query Engine │
                                        └──────────────┘
```

### Audit Trail

All data modifications logged to append-only audit table:
- API key used
- Query/operation details
- Timestamp
- Result (success/failure)

---

## Integration Points

### Smart Contract Event Listeners

**Standard Events:**
```solidity
// ERC-20
Transfer(address indexed from, address indexed to, uint256 value)
Approval(address indexed owner, address indexed spender, uint256 value)

// ERC-721
Transfer(address indexed from, address indexed to, uint256 indexed tokenId)

// ERC-8141 EntryPoint
UserOperationEvent(bytes32 indexed userOpHash, ...)
```

**Custom Event Processing:**
```typescript
interface EventHandler {
  event: string;
  contract: string;
  handler: (event: Log, context: IndexerContext) => Promise<void>;
}
```

### Wallet Connection Requirements

FrameSight supports read-only analytics without wallet connection. For personalized features:

- **WalletConnect v2** for multi-wallet support
- **SIWE** (Sign-In with Ethereum) for authentication
- **ERC-1271** for smart account signature verification

### Third-Party Data Sources

| Source | Data Type | Integration |
|--------|-----------|-------------|
| CoinGecko | Token prices | REST API |
| DefiLlama | Protocol TVL | REST API |
| Etherscan | Contract verification | REST API |
| The Graph | Subgraph data | GraphQL |
| Flashbots | MEV data | API |
| Chainlink | Oracle prices | On-chain events |

---

## Operational Considerations

### Monitoring & Alerting

Key metrics to track:
- **Indexing lag**: Time from block confirmation to DB insert
- **Query latency**: P50, P95, P99 API response times
- **Classification accuracy**: Precision/recall on intent detection
- **System health**: RPC endpoint availability, disk usage

### Deployment Strategy

Recommended infrastructure:
- **Kubernetes** for orchestration
- **Terraform** for IaC
- **GitHub Actions** for CI/CD
- **Grafana + Prometheus** for observability

---

## Related Documents

- [ADR-001: Indexing Engine Selection](./adrs/ADR-001-indexing-engine.md)
- [ADR-002: Database Schema Design](./adrs/ADR-002-database-schema.md)
- [ADR-003: ML Platform Architecture](./adrs/ADR-003-ml-platform.md)
- [API Reference](./api-reference.md)
- [Deployment Guide](./deployment.md)

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
