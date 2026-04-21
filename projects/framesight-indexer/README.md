# FrameSight Indexer

A custom Rust-based indexer for ERC-8141 Account Abstraction and intent-centric analytics.

## Overview

The FrameSight Indexer is a high-performance, real-time blockchain indexer built in Rust that captures and processes ERC-8141 (ERC-4337) Account Abstraction events from multiple EVM chains. It stores the indexed data in TimescaleDB for efficient time-series querying and analytics.

## Features

- **Multi-Chain Support**: Index Ethereum, Polygon, Optimism, Arbitrum, Base, and other chains
- **EntryPoint v0.6.0 & v0.7.0**: Full support for both EntryPoint contract versions
- **Real-time & Historical Indexing**: Support for realtime, backfill, and hybrid modes
- **TimescaleDB Integration**: Optimized time-series storage with automatic partitioning
- **Intent Classification**: Framework for classifying user intents from call data
- **REST API**: Health checks, metrics, and status endpoints
- **Docker Support**: Ready-to-deploy containerized service

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FrameSight Indexer                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   HTTP RPC   │  │ WebSocket WS │  │   Database   │     │
│  │  Connection  │  │ Subscription │  │    Layer     │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│  ┌──────▼──────────────────▼──────────────────▼──────┐     │
│  │                 Event Processor                     │     │
│  │  ┌──────────────┐  ┌──────────────┐              │     │
│  │  │ EntryPoint   │  │  Intent      │              │     │
│  │  │ Event Parser │  │  Classifier  │              │     │
│  │  └──────────────┘  └──────────────┘              │     │
│  └─────────────────────────────────────────────────────┘     │
│                           │                                  │
│  ┌───────────────────────▼─────────────────────────────┐     │
│  │              TimescaleDB Storage                     │     │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │     │
│  │  │ user_ops │ │accounts  │ │paymaster │            │     │
│  │  │_events   │ │_deployed │ │_events   │            │     │
│  │  └──────────┘ └──────────┘ └──────────┘            │     │
│  └─────────────────────────────────────────────────────┘     │
│                           │                                  │
│              ┌────────────▼────────────┐                      │
│              │     REST API Server    │                      │
│              │   /health /metrics     │                      │
│              └──────────────────────────┘                      │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Rust 1.75+ (for local development)
- Docker & Docker Compose (for containerized deployment)
- TimescaleDB 2.11+
- RPC endpoints for supported chains (e.g., Alchemy, Infura)

### Docker Deployment

1. Clone the repository:
```bash
cd projects/framesight-indexer
```

2. Create your environment file:
```bash
cp .env.example .env
# Edit .env with your RPC endpoints and database credentials
```

3. Build and run with Docker:
```bash
docker build -t framesight-indexer .
docker run -d \
  --name framesight-indexer \
  -p 8080:8080 \
  --env-file .env \
  framesight-indexer
```

### Docker Compose (Recommended)

```yaml
version: '3.8'

services:
  timescaledb:
    image: timescale/timescaledb:latest-pg15
    environment:
      POSTGRES_USER: framesight
      POSTGRES_PASSWORD: framesight
      POSTGRES_DB: framesight
    volumes:
      - timescale_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  indexer:
    build: .
    environment:
      INDEXER_DATABASE_URL: postgres://framesight:framesight@timescaledb:5432/framesight
      INDEXER_MODE: hybrid
      INDEXER_API_ENABLED: "true"
      INDEXER_API_BIND_ADDRESS: 0.0.0.0:8080
      RUST_LOG: info
    ports:
      - "8080:8080"
    depends_on:
      - timescaledb
    env_file:
      - .env

volumes:
  timescale_data:
```

### Local Development

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Set up the database:
```bash
# Install TimescaleDB or use Docker
docker run -d --name timescaledb \
  -e POSTGRES_USER=framesight \
  -e POSTGRES_PASSWORD=framesight \
  -e POSTGRES_DB=framesight \
  -p 5432:5432 \
  timescale/timescaledb:latest-pg15
```

3. Build and run:
```bash
cargo build --release
cargo run --release
```

## Configuration

Configuration can be provided via:
1. Environment variables (prefixed with `INDEXER_`)
2. `config.yaml` file
3. `.env` file

### Key Configuration Options

| Variable | Description | Default |
|----------|-------------|---------|
| `INDEXER_DATABASE_URL` | TimescaleDB connection string | Required |
| `INDEXER_MODE` | Indexing mode (realtime/backfill/hybrid) | hybrid |
| `INDEXER_API_ENABLED` | Enable REST API | true |
| `INDEXER_API_BIND_ADDRESS` | API server bind address | 0.0.0.0:8080 |

### Chain Configuration

Chains are configured in `config.yaml`. Each chain requires:
- `chain_id`: Chain ID (e.g., 1 for Ethereum)
- `rpc_url`: HTTP RPC endpoint
- `ws_url`: WebSocket endpoint (optional, for realtime)
- `entrypoint_v060` / `entrypoint_v070`: Contract addresses
- `start_block`: Block to start indexing from

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /ready` | Readiness probe (includes DB check) |
| `GET /metrics` | Basic service metrics |
| `GET /status` | Indexing status for all chains |

## Database Schema

The indexer creates the following TimescaleDB hypertables:

### `user_operations`
Stores UserOperationEvent data with time-series optimization.

### `account_deployed`
Stores AccountDeployed event data.

### `paymaster_events`
Tracks paymaster usage and events.

### `indexing_progress`
Tracks last indexed block per chain.

### `intent_classifications`
Stores ML-classified intent data.

## Indexing Modes

### Realtime Mode
- Subscribes to new blocks via WebSocket
- Processes events as they occur
- Lower latency for new data

### Backfill Mode
- Historical indexing from a start block
- Batch processing for efficiency
- Useful for catching up or full re-indexing

### Hybrid Mode (Default)
- Runs backfill first to catch up
- Switches to realtime once caught up
- Best for production deployments

## Monitoring

The indexer exposes metrics via the REST API:

```bash
# Health check
curl http://localhost:8080/health

# Indexing status
curl http://localhost:8080/status

# Database metrics query
SELECT 
    chain_id,
    count(*) as ops_per_hour
FROM user_operations
WHERE time > now() - interval '1 hour'
GROUP BY chain_id;
```

## Supported Events

### EntryPoint Events
- `UserOperationEvent`: Successful/failed user operations
- `AccountDeployed`: Smart account deployments

### Paymaster Events
- User operation sponsorship tracking
- Token-based paymaster events
- Gas sponsorship analytics

## Intent Classification

The indexer provides a framework for intent classification:

1. **Call Data Decoding**: Extract function signatures and parameters
2. **Pattern Matching**: Match against known intent patterns
3. **ML Classification**: Integration point for ML classifier
4. **Confidence Scoring**: Store classification confidence

Supported intent types:
- Token transfers
- NFT transfers
- Swaps
- Bridging
- Staking/unstaking
- Governance voting
- Contract deployment
- Multicalls

## Troubleshooting

### Connection Issues
- Verify RPC endpoints are accessible
- Check WebSocket support for realtime mode
- Ensure database is running and accessible

### Performance
- Adjust `max_concurrent_blocks` for your RPC limits
- Increase `block_batch_size` for faster backfills
- Monitor database connection pool

### Memory Usage
- Reduce batch sizes if OOM issues occur
- Enable swap for large backfill operations

## Development

### Project Structure
```
src/
├── main.rs           # Entry point
├── config.rs         # Configuration management
├── db/               # Database layer
│   └── mod.rs
├── events/           # Event types
│   └── mod.rs
├── indexer/          # Indexing logic
│   └── mod.rs
├── contracts/        # Contract ABIs and addresses
│   └── mod.rs
└── api/              # REST API
    └── mod.rs
```

### Adding a New Chain

1. Add chain configuration to `config.yaml`
2. Verify EntryPoint contract addresses
3. Set appropriate `start_block` (deployment block)
4. Test with backfill mode first

### Testing

```bash
# Run tests
cargo test

# Run with specific features
cargo test --features kafka
```

## Contributing

1. Create a feature branch: `git checkout -b feature/your-feature`
2. Make changes with tests
3. Submit a pull request

## License

MIT License - See LICENSE file for details

## References

- [ERC-4337: Account Abstraction](https://eips.ethereum.org/EIPS/eip-4337)
- [EntryPoint v0.6.0 Contract](https://etherscan.io/address/0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789)
- [EntryPoint v0.7.0 Contract](https://etherscan.io/address/0x0000000071727De22E5E9d8BAf0edAc6f37da032)
- [TimescaleDB Documentation](https://docs.timescale.com/)
