# FrameSight Graph Node

Self-hosted The Graph Protocol node for standard ERC event indexing per [ADR-001](../docs/framesight/adrs/ADR-001-indexing-engine.md).

## Overview

The FrameSight Graph Node provides GraphQL-based indexing for standard blockchain data:
- **ERC-20** token transfers and approvals
- **ERC-721/1155** NFT events
- **ERC-8141** EntryPoint Account Abstraction events

This is the "standard data" leg of our hybrid indexing architecture (The Graph for standard data, custom Rust indexer for specialized AA/intent data).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FrameSight Graph Stack                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Graph Node   │  │ PostgreSQL   │  │ IPFS Node    │      │
│  │ (indexing)   │  │ (metadata)   │  │ (subgraphs)  │      │
│  └──────┬───────┘  └──────────────┘  └──────────────┘      │
│         │                                                    │
│  ┌──────▼──────────────────────────────────────────────┐   │
│  │              Subgraph Definitions                      │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐              │   │
│  │  │ ERC20  │  │  NFT   │  │EntryPt │              │   │
│  │  │Transfer│  │721/1155│  │ v0.6/7 │              │   │
│  │  └────────┘  └────────┘  └────────┘              │   │
│  └─────────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌──────▼────────────┐                                       │
│  │  GraphQL API      │  ← Query endpoint                     │
│  │  localhost:8000   │                                       │
│  └───────────────────┘                                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Docker & Docker Compose
- RPC endpoints (Alchemy, Infura, or QuickNode)
- 50GB+ free disk space for PostgreSQL and IPFS data

### 1. Clone and Configure

```bash
cd projects/framesight-graph

# Copy environment template
cp .env.example .env

# Edit .env with your RPC endpoints
# Get API keys from:
# - Alchemy: https://dashboard.alchemy.com/
# - Infura: https://infura.io/
# - QuickNode: https://www.quicknode.com/
```

### 2. Start the Stack

```bash
# Start all services
docker-compose up -d

# Wait for services to be healthy (30-60 seconds)
docker-compose ps

# View logs
docker-compose logs -f graph-node
```

### 3. Deploy Subgraphs

```bash
# Deploy all subgraphs
docker-compose --profile deploy up subgraph-deployer

# Or deploy individually
cd subgraphs/erc20
npm run create-local
npm run deploy-local
```

### 4. Query Data

```bash
# GraphQL endpoint
curl http://localhost:8000/subgraphs/name/framesight/erc20 \
  -H "Content-Type: application/json" \
  -d '{"query": "{ transfers(first: 5) { id from { id } to { id } value } }"}'
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| Graph Node Query | 8000 | GraphQL API endpoint |
| Graph Node Admin | 8020 | Subgraph deployment |
| Graph Node RPC | 8030 | Internal JSON-RPC |
| Graph Node Metrics | 8040 | Prometheus metrics |
| PostgreSQL | 5433 | Graph node metadata store |
| IPFS API | 5001 | Subgraph IPFS storage |
| IPFS Gateway | 8081 | IPFS HTTP gateway |

## Subgraphs

### ERC-20 Transfers (`/subgraphs/erc20`)

Indexes ERC-20 token transfers across multiple chains.

**Entities:**
- `Transfer` - Token transfer events
- `Token` - Token metadata (name, symbol, decimals, supply)
- `Account` - Token holder accounts
- `AccountBalance` - Per-token balances
- `DailyTransferVolume` / `HourlyTransferVolume` - Time-series aggregates

**Example Query:**
```graphql
{
  transfers(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    from { address }
    to { address }
    value
    token { symbol decimals }
  }
}
```

### NFT Events (`/subgraphs/nft`)

Indexes ERC-721 and ERC-1155 NFT events.

**Entities:**
- `NFTContract` - NFT collection metadata
- `NFTToken` - Individual NFT tokens
- `NFTTransfer` - Transfer events (supports batch)
- `Account` - NFT owners
- `DailyNFTVolume` - Trading volume aggregates

**Example Query:**
```graphql
{
  nftTransfers(first: 10) {
    id
    token { tokenId contract { name } }
    from { address }
    to { address }
    isBatch
  }
}
```

### EntryPoint (`/subgraphs/entrypoint`)

Indexes ERC-4337/8141 Account Abstraction UserOperation events.

**Entities:**
- `UserOperation` - User operation events (v0.6.0 & v0.7.0)
- `AccountDeployed` - Smart account deployments
- `Account` - Smart contract accounts
- `Paymaster` - Gas sponsor tracking
- `DailyUserOperationStats` - Usage analytics

**Example Query:**
```graphql
{
  userOperations(first: 10, orderBy: blockTimestamp, orderDirection: desc) {
    userOpHash
    sender { address }
    paymaster
    success
    actualGasUsed
    actualGasCost
  }
}
```

## Configuration

### Environment Variables (`.env`)

```bash
# RPC Endpoints (required)
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ETH_WS_URL=wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
POLYGON_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY
OPTIMISM_RPC_URL=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY
ARBITRUM_RPC_URL=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
BASE_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY

# Graph Node Settings
GRAPH_LOG_LEVEL=info
GRAPH_QUERY_TIMEOUT=30
GRAPH_MAX_COMPLEXITY=1000000
GRAPH_DB_POOL_SIZE=10

# Ports (optional, for avoiding conflicts)
GRAPH_POSTGRES_PORT=5433
GRAPH_NODE_QUERY_PORT=8000
GRAPH_NODE_ADMIN_PORT=8020
IPFS_API_PORT=5001
```

### Network Configuration

To add support for additional networks:

1. Add RPC URLs to `.env`
2. Update `docker-compose.yml` `ethereum` env var
3. Add network entries to subgraph manifests

## Development

### Adding a New Subgraph

```bash
cd subgraphs
graph init --product subgraph-studio --from-contract <CONTRACT_ADDRESS> --abi <ABI_FILE> new-subgraph
cd new-subgraph
npm install
# Edit schema.graphql, subgraph.yaml, src/mapping.ts
```

### Local Testing

```bash
# Start with fresh data
docker-compose down -v
docker-compose up -d

# Watch indexing progress
curl http://localhost:8030/jsonrpc \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "method": "subgraph_list", "id": "1"}'
```

## Troubleshooting

### Graph Node won't start

```bash
# Check PostgreSQL is healthy
docker-compose logs graph-postgres

# Reset everything
docker-compose down -v
docker-compose up -d
```

### Subgraph deployment fails

```bash
# Ensure IPFS is ready
docker-compose logs graph-ipfs

# Redeploy subgraph
npm run create-local --force
npm run deploy-local
```

### Slow indexing

- Increase `GRAPH_STORE_POOL_SIZE` (default: 10)
- Use WebSocket URLs for real-time indexing
- Consider backfill mode for historical data

## Integration with FrameSight

The Graph Node integrates with FrameSight's query layer:

1. **GraphQL Federation**: Combine Graph subgraphs with custom indexer data
2. **Real-time Updates**: WebSocket subscriptions for live data
3. **Caching Layer**: Redis cache for hot queries

See [ADR-001](../docs/framesight/adrs/ADR-001-indexing-engine.md) for the hybrid architecture rationale.

## Monitoring

### Prometheus Metrics

Graph Node exposes metrics at `http://localhost:8040/metrics`:

- `graph_query_total_time` - Query latency
- `graph_eth_rpc_request_duration` - RPC call duration
- `graph_sync_blocks_behind` - Indexing lag

### Health Checks

```bash
# Graph Node health
curl http://localhost:8030

# Subgraph status
curl http://localhost:8000/subgraphs/name/framesight/erc20 \
  -d '{"query": "{ _meta { block { number } } }"}'
```

## Maintenance

### Database Cleanup

```bash
# Remove old subgraph versions
docker exec -it framesight-graph-node graphman drop --force <subgraph-name>

# Vacuum PostgreSQL
docker exec -it framesight-graph-postgres psql -U graphnode -c "VACUUM FULL;"
```

### Upgrading Graph Node

```bash
docker-compose pull graph-node
docker-compose up -d graph-node
```

## References

- [The Graph Documentation](https://thegraph.com/docs/)
- [Graph Node GitHub](https://github.com/graphprotocol/graph-node)
- [ERC-4337 Specification](https://eips.ethereum.org/EIPS/eip-4337)
- [ERC-8141: Account Abstraction EntryPoint](https://eips.ethereum.org/EIPS/eip-8141)

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
