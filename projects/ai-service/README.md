# AI-Stacks AI Service

AI-powered document analysis and summarization service for the AI-Stacks platform.

## Features

- **AI Summarization** - Multiple strategies: extractive, abstractive, bullets, TL;DR
- **Multi-document Support** - Summarize up to 10 documents at once
- **Caching Layer** - Redis-based caching for repeated content (1-hour TTL)
- **Async Processing** - Queue jobs for large documents via BullMQ
- **Rate Limiting** - Per-tenant rate limiting with Redis
- **Streaming Ready** - Architecture supports streaming responses (future)

## API Endpoints

### Summarization

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/v1/ai/summarize` | Generate summary |
| GET | `/v1/ai/summarize/strategies` | List available strategies |
| GET | `/v1/ai/summarize/lengths` | List available lengths |

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/health` | Basic health check |
| GET | `/v1/health/ready` | Readiness with dependencies |
| GET | `/v1/health/cache` | Cache health |

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Run Development Server

```bash
pnpm dev
```

The service will start on `http://localhost:3001`

### 4. API Documentation

Visit `http://localhost:3001/docs` for interactive Swagger UI.

## Usage Examples

### Synchronous Summary

```bash
curl -X POST http://localhost:3001/v1/ai/summarize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "text": "Your long document text here...",
    "strategy": "abstractive",
    "length": "medium"
  }'
```

Response:
```json
{
  "id": "uuid",
  "summary": "Generated summary text...",
  "strategy": "abstractive",
  "length": "medium",
  "metadata": {
    "inputTokens": 1500,
    "outputTokens": 250,
    "processingTime": 3200,
    "cached": false
  },
  "createdAt": "2026-01-01T00:00:00.000Z"
}
```

### Async Summary (for large documents)

```bash
curl -X POST http://localhost:3001/v1/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": ["doc-1", "doc-2"],
    "strategy": "extractive",
    "length": "long",
    "async": true
  }'
```

Response:
```json
{
  "jobId": "bull-job-id",
  "status": "queued",
  "message": "Summary job has been queued for processing"
}
```

### Multi-Document Summary

```bash
curl -X POST http://localhost:3001/v1/ai/summarize \
  -H "Content-Type: application/json" \
  -d '{
    "documentIds": [
      "550e8400-e29b-41d4-a716-446655440000",
      "550e8400-e29b-41d4-a716-446655440001"
    ],
    "strategy": "bullets",
    "length": "medium",
    "focus": "financial results"
  }'
```

## Summarization Strategies

### Extractive
Selects and combines the most important sentences from the original text. Fast and preserves original wording.

### Abstractive
Generates new text that captures the essence of the original content. Uses AI to paraphrase and synthesize.

### Bullet Points
Presents key information as a structured list of bullet points for easy scanning.

### TL;DR
Very brief summary (1-2 sentences) for quick understanding.

## Summary Lengths

| Length | Approximate Ratio | Use Case |
|--------|-------------------|----------|
| Short | 10-20% | Quick overview |
| Medium | 20-30% | Balanced detail |
| Long | 30-40% | Comprehensive |

## Architecture

```
┌─────────────────┐
│   AI Service    │
│   (Port 3001)   │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌──────────┐
│ Redis │ │ Job Queue│
│ Cache │ │ BullMQ   │
└───────┘ └──────────┘
```

## Integration with Job Queue

For large documents or high-load scenarios, use async processing:

```typescript
import { addJob, QueueName, AIJobType } from '@ai-stacks/job-queue';

const jobId = await addJob(
  QueueName.AI_PROCESSING,
  AIJobType.SUMMARIZE,
  {
    tenantId: 'tenant-uuid',
    payload: {
      documentId: 'doc-uuid',
      strategy: 'abstractive',
      length: 'medium',
    },
  },
  { priority: 7 }
);
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | Server port |
| `HOST` | No | `0.0.0.0` | Server host |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `RATE_LIMIT_MAX` | No | `100` | Requests per window |
| `RATE_LIMIT_WINDOW` | No | `1 minute` | Rate limit window |

## Dependencies

- **@ai-stacks/job-queue** - Async job processing
- **@ai-stacks/database** - Document storage (future)
- **Fastify** - Web framework
- **BullMQ** - Job queue integration
- **Redis** - Caching layer
- **Zod** - Request validation

## License

MIT

Co-Authored-By: Paperclip <noreply@paperclip.ing>
