# ADR-002: Database Schema Design

## Status
Accepted

## Context

FrameSight needs to store diverse blockchain data:
- Time-series block and transaction data
- Relational entity data (addresses, contracts, tokens)
- Vector embeddings for semantic search
- Aggregated analytics

We need a database strategy that balances:
- Query performance (complex analytical queries)
- Storage cost (blockchain data is large)
- Flexibility (schema evolves with new chains/protocols)

## Decision

We will use a **polyglot persistence** strategy:

### 1. TimescaleDB for Time-Series Data

**Primary database for blockchain events.**

Tables:
```sql
-- Blocks table (hypertable)
CREATE TABLE blocks (
    time TIMESTAMPTZ NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    block_hash TEXT NOT NULL,
    parent_hash TEXT,
    gas_used BIGINT,
    gas_limit BIGINT,
    base_fee_per_gas NUMERIC,
    UNIQUE(chain_id, block_number)
);
SELECT create_hypertable('blocks', 'time');

-- Transactions table (hypertable)
CREATE TABLE transactions (
    time TIMESTAMPTZ NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    tx_hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT,
    value NUMERIC,
    gas_price NUMERIC,
    gas_used BIGINT,
    status INTEGER,
    intent_classification TEXT,
    intent_confidence FLOAT,
    UNIQUE(chain_id, tx_hash)
);
SELECT create_hypertable('transactions', 'time');

-- Events table (hypertable) - for all event logs
CREATE TABLE events (
    time TIMESTAMPTZ NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    tx_hash TEXT NOT NULL,
    log_index INTEGER NOT NULL,
    address TEXT NOT NULL,      -- contract address
    topic0 TEXT,                -- event signature
    topic1 TEXT,                -- indexed param 1
    topic2 TEXT,                -- indexed param 2
    topic3 TEXT,                -- indexed param 3
    data TEXT,                  -- unindexed data
    decoded_event JSONB,        -- parsed event data
    UNIQUE(chain_id, tx_hash, log_index)
);
SELECT create_hypertable('events', 'time');

-- UserOperations table (hypertable) - ERC-8141
CREATE TABLE user_operations (
    time TIMESTAMPTZ NOT NULL,
    chain_id INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    tx_hash TEXT NOT NULL,
    user_op_hash TEXT NOT NULL,
    sender TEXT NOT NULL,
    nonce NUMERIC,
    paymaster TEXT,
    actual_gas_cost NUMERIC,
    actual_gas_used BIGINT,
    success BOOLEAN,
    intent_classification TEXT,
    UNIQUE(chain_id, user_op_hash)
);
SELECT create_hypertable('user_operations', 'time');
```

**Rationale:**
- TimescaleDB = PostgreSQL + time-series superpowers
- Native compression reduces storage by 90%+
- Continuous aggregates for rollups
- Familiar SQL for team

### 2. PostgreSQL (Standard) for Relational Data

Tables:
```sql
-- Addresses/Accounts
CREATE TABLE addresses (
    address TEXT PRIMARY KEY,
    chain_id INTEGER,
    address_type TEXT,  -- 'eoa', 'contract', 'smart_account'
    first_seen_at TIMESTAMPTZ,
    tags TEXT[],        -- ['uniswap_v3_pool', 'erc20_holder']
    metadata JSONB      -- protocol-specific metadata
);

-- Tokens
CREATE TABLE tokens (
    address TEXT PRIMARY KEY,
    chain_id INTEGER,
    token_type TEXT,    -- 'erc20', 'erc721', 'erc1155'
    name TEXT,
    symbol TEXT,
    decimals INTEGER,
    total_supply NUMERIC,
    metadata JSONB
);

-- Contracts
CREATE TABLE contracts (
    address TEXT PRIMARY KEY,
    chain_id INTEGER,
    deployed_at TIMESTAMPTZ,
    deployer TEXT,
    bytecode_hash TEXT,
    verified BOOLEAN,
    abi JSONB,
    source_code TEXT
);

-- Intent Classifications (reference table)
CREATE TABLE intent_types (
    id TEXT PRIMARY KEY,
    category TEXT,      -- 'defi', 'nft', 'social', 'governance'
    name TEXT,
    description TEXT,
    method_signatures TEXT[]  -- associated 4byte signatures
);
```

### 3. pgvector for Semantic Search

Extension on same PostgreSQL instance:
```sql
CREATE EXTENSION vector;

-- Intent embeddings for similarity search
CREATE TABLE intent_embeddings (
    id SERIAL PRIMARY KEY,
    tx_hash TEXT,
    chain_id INTEGER,
    embedding VECTOR(384),  -- all-MiniLM-L6-v2 embeddings
    intent_text TEXT,      -- human-readable description
    created_at TIMESTAMPTZ
);

CREATE INDEX ON intent_embeddings USING ivfflat (embedding vector_cosine_ops);
```

### 4. Redis for Caching

**Ephemeral data only:**
- Hot query results
- Rate limiting counters
- Session state
- Real-time subscriptions

## Data Retention Policy

```sql
-- Compress chunks older than 7 days
SELECT add_compression_policy('transactions', INTERVAL '7 days');

-- Drop raw events after 90 days (keep aggregates)
SELECT add_retention_policy('events', INTERVAL '90 days');

-- Move to S3 after 1 year (via pg_dump or logical replication)
```

## Consequences

### Positive
- Single PostgreSQL ecosystem reduces complexity
- TimescaleDB compression saves significant storage costs
- Time-based partitioning makes historical queries efficient
- pgvector enables semantic features without new infrastructure

### Negative
- TimescaleDB licensing considerations for managed services
- Must tune chunk sizes for optimal performance
- Backups are larger due to time-series volume

## Migration Strategy

### Phase 1: Schema Setup
1. Provision TimescaleDB Cloud or self-hosted
2. Run schema migrations
3. Set up retention policies

### Phase 2: Backfill
1. Historical sync from RPC/archive nodes
2. Verify data integrity
3. Build continuous aggregates

### Phase 3: Optimization
1. Enable compression
2. Tune chunk sizes based on query patterns
3. Set up read replicas

## Related

- [ADR-001: Indexing Engine Selection](./ADR-001-indexing-engine.md)
- [ADR-003: ML Platform Architecture](./ADR-003-ml-platform.md)
- FrameSight Architecture Overview: [README](./../README.md)

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
