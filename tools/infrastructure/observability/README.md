# FrameSight Observability & Monitoring

## Overview
Comprehensive monitoring stack for FrameSight platform using modern observability tools.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Applications                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Website   │  │    API      │  │   AI Agents         │   │
│  │  (Next.js)  │  │  (Python)   │  │  (Python/Node)      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘   │
└───────┼──────────────────┼────────────────────┼──────────────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Data Collection                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   OpenTelemetry Collector                    │   │
│  │  (Traces, Metrics, Logs)                     │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Storage & Analysis                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │
│  │   Tempo     │  │   Mimir     │  │       Loki          │   │
│  │  (Traces)   │  │  (Metrics)  │  │      (Logs)         │   │
│  └─────────────┘  └─────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
        │                  │                    │
        ▼                  ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                      Visualization                           │
│                    ┌─────────────┐                          │
│                    │   Grafana   │                          │
│                    │  (Dashboards)│                          │
│                    └─────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Metrics (Mimir/Prometheus)
**Application Metrics:**
- Request rate, latency (p50, p95, p99)
- Error rate by endpoint
- Active users, session duration
- AI model token usage & cost

**Infrastructure Metrics:**
- CPU, memory, disk usage
- Database connections, query latency
- Queue depth (Redis)
- Container restart count

**Business Metrics:**
- API calls per tier
- AI analysis requests per model
- Blockchain events processed/min

### 2. Traces (Tempo/Jaeger)
**Distributed Tracing:**
- End-to-end request flow
- AI agent execution traces
- Database query tracing
- External API call latency

**Key Spans:**
- `website_request`
- `api_handler`
- `db_query`
- `ai_model_call`
- `blockchain_fetch`

### 3. Logs (Loki)
**Structured Logging:**
- JSON format with correlation IDs
- Log levels: ERROR, WARN, INFO, DEBUG
- Context: user_id, request_id, trace_id

**Log Categories:**
- Application logs
- Access logs (nginx)
- Database slow query logs
- AI model output logs

## Key Dashboards

### 1. Executive Overview
- System health (green/yellow/red)
- Cost per AI request
- User growth trend
- Error budget remaining

### 2. Engineering - Website
- Page load times by route
- Core Web Vitals (LCP, FID, CLS)
- Error rates by page
- Vercel deployment status

### 3. Engineering - API
- Request rate & latency
- AI model performance
- Database query performance
- Cache hit rates

### 4. Engineering - AI/ML
- Model inference latency
- Token usage by model
- Cost per model
- Prediction accuracy (tracked)

### 5. Engineering - Blockchain
- Events processed/sec
- RPC endpoint health
- The Graph sync status
- Alert firing rate

## Alerting Rules

### Critical (Page on-call)
- API error rate > 5%
- Database connection failures
- AI model complete failure
- Website down (0% availability)

### Warning (Slack notification)
- API latency p95 > 500ms
- Database slow queries > 100/min
- AI model latency > 10s
- Disk usage > 80%

### Info (Log only)
- Deployment completed
- Database migration applied
- Cache eviction rate high

## Alert Routing

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Alert     │───→│  PagerDuty  │───→│   Slack     │
│   Manager   │    │  (Critical) │    │  (#alerts)  │
└─────────────┘    └─────────────┘    └─────────────┘
```

## SLOs (Service Level Objectives)

### Website
- Availability: 99.9%
- p95 Latency: < 200ms
- Core Web Vitals: Good

### API
- Availability: 99.95%
- p99 Latency: < 500ms
- Error Rate: < 0.1%

### AI Services
- Availability: 99.5%
- p95 Inference: < 5s
- Queue wait: < 30s

## Runbooks

### High Error Rate
1. Check recent deployments
2. Review error logs in Grafana
3. Check downstream service health
4. Consider rollback

### Database Slow Queries
1. Identify top 10 slow queries
2. Check index usage
3. Review connection pool status
4. Consider query optimization

### AI Model Latency
1. Check model provider status
2. Review queue depth
3. Check token usage patterns
4. Consider model fallback
