# FrameSight TimescaleDB Migration Scripts

## Overview
Migration scripts for transitioning FrameSight from SQLite to TimescaleDB with pgvector support.

## Prerequisites
- PostgreSQL 15+ with TimescaleDB extension
- pgvector extension installed

## Migration Phases

### Phase 1: Schema Creation
```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS vector;

-- Core tables with hypertables for time-series data
```

### Phase 2: Data Migration
- Export from SQLite
- Transform and load to PostgreSQL
- Validate data integrity

### Phase 3: Verification & Cutover
- Run parallel validation
- Switch application connections
- Monitor performance

## Files
- `01_schema.sql` - Database schema with hypertables
- `02_seed.sql` - Reference data
- `migrate.py` - Python migration script
- `docker-compose.yml` - Local development environment
- `validate.py` - Data validation script
