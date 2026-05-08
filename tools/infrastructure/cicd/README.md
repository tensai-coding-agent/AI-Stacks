# CI/CD Architecture for FrameSight Platform

## Overview
Multi-environment deployment pipeline for Tensai website and FrameSight platform.

## Environments

### 1. Development (dev)
- **Branch**: `feature/*`, `develop`
- **URL**: `https://dev.tensai.local`
- **Database**: Local Docker (TimescaleDB)
- **Deployment**: Automatic on PR

### 2. Staging (staging)
- **Branch**: `main` (pre-release)
- **URL**: `https://staging.tensai.fyi`
- **Database**: Cloud TimescaleDB (small instance)
- **Deployment**: Automatic on merge to main

### 3. Production (prod)
- **Branch**: `main` (tagged releases)
- **URL**: `https://tensai.fyi`
- **Database**: Cloud TimescaleDB (production cluster)
- **Deployment**: Manual approval required

## Pipeline Stages

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    Build    │───→│    Test     │───→│   Deploy    │───→│  Validate   │
│  → Docker   │    │  → Unit     │    │  → Staging  │    │  → Health   │
│  → Assets   │    │  → E2E      │    │  → Prod     │    │  → Metrics  │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
```

## GitHub Actions Workflows

### Website Deployment (`website-deploy.yml`)
```yaml
name: Website Deploy
on:
  push:
    branches: [main, develop]
    paths: ['website/**']
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: npm run test
  
  deploy-staging:
    needs: build
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: # Deploy to staging
  
  deploy-prod:
    needs: deploy-staging
    if: github.ref == 'refs/heads/main' && startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: # Deploy to production
```

### Database Migration (`db-migrate.yml`)
```yaml
name: Database Migration
on:
  workflow_dispatch:
    inputs:
      environment:
        type: choice
        options: [staging, production]
      migration_script:
        type: string
        required: true

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ github.event.inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - name: Run migration
        run: |
          psql ${{ secrets.DATABASE_URL }} \
            -f ${{ github.event.inputs.migration_script }}
```

## Deployment Strategies

### Website (Static)
- **Platform**: Vercel / Netlify / Cloudflare Pages
- **Strategy**: Atomic deployments with rollback
- **CDN**: Global edge caching
- **Preview URLs**: Per-PR deployments

### API/Backend (Containerized)
- **Platform**: AWS ECS / Google Cloud Run / Railway
- **Strategy**: Blue-green deployment
- **Health Checks**: `/health` endpoint verification
- **Rollback**: Automatic on health check failure

### Database
- **Platform**: Timescale Cloud / AWS RDS PostgreSQL
- **Strategy**: Zero-downtime migrations
- **Backups**: Daily automated + point-in-time recovery
- **Read Replicas**: For analytics workloads

## Secrets Management

### GitHub Secrets Required
```
# Deployment
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID

# Database
DATABASE_URL_STAGING
DATABASE_URL_PRODUCTION
TIMESCALE_TOKEN

# Cloud
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
GCP_SERVICE_ACCOUNT_KEY

# Monitoring
SENTRY_DSN
DATADOG_API_KEY
```

## Monitoring & Alerts

### Health Checks
- **Uptime**: HTTP 200 on `/health`
- **Latency**: p95 < 200ms
- **Error Rate**: < 0.1%

### Deployment Notifications
- Slack: #deployments channel
- Email: ops@tensai.local
- PagerDuty: On-call rotation for prod failures

## Rollback Procedures

### Website Rollback
```bash
# Vercel
vercel rollback --yes

# Netlify
netlify rollback --site-id=$SITE_ID
```

### Database Rollback
```bash
# Restore from backup
pg_restore --clean --if-exists backup.dump
```
