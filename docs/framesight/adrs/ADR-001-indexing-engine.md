# ADR-001: Indexing Engine Selection

## Status
Accepted

## Context

FrameSight requires a robust indexing solution for Ethereum and L2 blockchain data. We need to balance between:
- Development velocity (avoid building everything from scratch)
- Flexibility (support custom indexing needs like ERC-8141)
- Cost efficiency (runway-conscious startup)
- Performance (sub-second query latency for hot data)

## Decision

We will use a **hybrid indexing architecture**:

### 1. The Graph Protocol for Standard Data

Use The Graph for well-defined, standard data types:
- ERC-20 transfers
- ERC-721/1155 NFT events
- Popular DeFi protocols (Uniswap, Aave, etc.)

**Rationale:**
- Mature ecosystem with existing subgraphs
- GraphQL API out of the box
- Cost-effective for standard use cases
- Battle-tested at scale

**Deployment Model:**
- Self-hosted graph-node for cost control
- Custom subgraphs for proprietary needs

### 2. Custom Indexer for Specialized Data

Build a custom Rust-based indexer for:
- ERC-8141 Account Abstraction UserOperations
- Intent-centric event detection
- Real-time anomaly detection
- Cross-chain correlation

**Rationale:**
- Full control over data model
- Optimized for our specific query patterns
- Can integrate ML inference at ingestion time
- Lower latency for real-time features

**Technology Stack:**
- **Language:** Rust (async, memory-safe, fast)
- **Web3 Library:** ethers-rs or alloy
- **Database:** Direct TimescaleDB writes
- **Message Queue:** Kafka for event streaming

## Consequences

### Positive
- Best of both worlds: standard data is cheap, custom data is optimized
- Team can focus engineering effort on differentiators (intents, AA)
- Clear migration path: start with Graph, migrate hot paths to custom

### Negative
- Two indexing systems to maintain
- Potential data consistency challenges between systems
- Team needs Rust expertise

## Alternatives Considered

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| The Graph Only | Simple, cheap | Can't handle AA/intents well | Rejected |
| Custom Only | Full control | High engineering cost | Rejected |
| Dune Analytics | No infra | No real-time, limited customization | Rejected |
| Alchemy/Quicknode | Fully managed | Expensive at scale, vendor lock-in | Future option |

## Implementation Notes

### Phase 1: The Graph Foundation
1. Deploy graph-node locally
2. Fork/modify existing subgraphs for DeFi protocols
3. Create custom subgraph for ERC-8141 EntryPoint

### Phase 2: Custom Indexer
1. Build Rust event listener for EntryPoint events
2. Add intent classification at ingestion
3. Integrate with message queue for real-time consumers

### Phase 3: Optimization
1. Migrate hot paths from Graph to custom indexer
2. Implement caching layer
3. Add horizontal scaling for indexers

## Related

- [ADR-002: Database Schema Design](./ADR-002-database-schema.md)
- Epic: [TEN-12 FrameSight](/TEN/issues/TEN-12)

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
