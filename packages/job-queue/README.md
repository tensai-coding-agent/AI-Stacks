# @ai-stacks/job-queue

Job queue system with BullMQ and Redis for AI-Stacks async processing.

## Features

- **BullMQ v5.x** - Modern Redis-backed job queue
- **Multiple specialized queues**: documents, ai-processing, webhooks, notifications
- **Priority support** - Critical jobs processed first
- **Progress tracking** - Real-time job progress updates
- **Retry logic** - Exponential backoff with dead letter queue
- **Rate limiting** - Prevent overwhelming downstream services
- **Monitoring** - Health checks and queue metrics
- **Graceful shutdown** - Clean worker termination

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Set Environment Variables

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_PASSWORD=optional
export REDIS_DB=0
```

### 3. Initialize Queue System

```typescript
import { 
  initializeJobQueue, 
  addJob, 
  QueueName, 
  DocumentJobType,
  getHealthStatus 
} from '@ai-stacks/job-queue';

// Initialize all queues and workers
const { queues, workers } = initializeJobQueue();

// Add a document processing job
const jobId = await addJob(
  QueueName.DOCUMENTS,
  DocumentJobType.PARSE_PDF,
  {
    tenantId: 'tenant-uuid',
    userId: 'user-uuid',
    payload: {
      documentId: 'doc-uuid',
      filename: 'report.pdf',
      fileSize: 1024000,
    },
  },
  { priority: 5 }
);

// Check health status
const health = await getHealthStatus();
console.log(health);
```

## Queue Types

### Document Queue
Processes document uploads and text extraction.

```typescript
import { QueueName, DocumentJobType, addJob } from '@ai-stacks/job-queue';

// PDF text extraction
await addJob(QueueName.DOCUMENTS, DocumentJobType.PARSE_PDF, {
  tenantId,
  payload: { documentId, filename, fileSize, pageCount },
});

// DOCX extraction
await addJob(QueueName.DOCUMENTS, DocumentJobType.PARSE_DOCX, {
  tenantId,
  payload: { documentId, filename },
});

// OCR for images
await addJob(QueueName.DOCUMENTS, DocumentJobType.OCR_IMAGE, {
  tenantId,
  payload: { documentId, imageType: 'image/png' },
});
```

### AI Processing Queue
Handles AI/LLM operations with lower concurrency.

```typescript
import { QueueName, AIJobType, addJob } from '@ai-stacks/job-queue';

// Document summarization
await addJob(QueueName.AI_PROCESSING, AIJobType.SUMMARIZE, {
  tenantId,
  payload: { 
    documentId, 
    strategy: 'abstractive', // 'extractive' | 'bullets' | 'tldr'
    length: 'medium', // 'short' | 'medium' | 'long'
  },
}, { priority: 8 }); // Higher priority

// Entity extraction
await addJob(QueueName.AI_PROCESSING, AIJobType.EXTRACT_ENTITIES, {
  tenantId,
  payload: { documentId, entityTypes: ['PERSON', 'ORG', 'DATE'] },
});

// Classification
await addJob(QueueName.AI_PROCESSING, AIJobType.CLASSIFY, {
  tenantId,
  payload: { documentId, categories: ['contract', 'invoice', 'report'] },
});

// Generate embeddings
await addJob(QueueName.AI_PROCESSING, AIJobType.GENERATE_EMBEDDINGS, {
  tenantId,
  payload: { documentId, chunks: 5 },
});
```

### Webhook Queue
Reliable webhook delivery with retries.

```typescript
import { QueueName, WebhookJobType, addJob } from '@ai-stacks/job-queue';

await addJob(QueueName.WEBHOOKS, WebhookJobType.SEND_WEBHOOK, {
  tenantId,
  payload: {
    url: 'https://example.com/webhook',
    event: 'document.processed',
    data: { documentId, status: 'completed' },
  },
});
```

## Priority Levels

```typescript
import { JobPriority } from '@ai-stacks/job-queue';

await addJob(QueueName.AI_PROCESSING, AIJobType.SUMMARIZE, data, {
  priority: JobPriority.CRITICAL, // 10 - Process first
});

await addJob(QueueName.DOCUMENTS, DocumentJobType.PARSE_PDF, data, {
  priority: JobPriority.HIGH, // 8
});

await addJob(QueueName.WEBHOOKS, WebhookJobType.SEND_WEBHOOK, data, {
  priority: JobPriority.NORMAL, // 5 (default)
});
```

## Monitoring & Health

```typescript
import { getQueueMetrics, getHealthStatus } from '@ai-stacks/job-queue';

// Get detailed metrics for all queues
const metrics = await getQueueMetrics();
console.log(metrics);
// {
//   documents: { counts: { waiting: 5, active: 2, completed: 100 }, ... },
//   'ai-processing': { counts: { waiting: 3, active: 1 }, ... },
//   ...
// }

// Get health status for monitoring endpoints
const health = await getHealthStatus();
console.log(health);
// {
//   healthy: true,
//   queues: {
//     documents: { status: 'healthy', pending: 5, failed: 2 },
//     'ai-processing': { status: 'healthy', pending: 3, failed: 0 },
//   },
//   workers: { document: true, ai: true, webhook: true }
// }
```

## Graceful Shutdown

```typescript
import { 
  initializeJobQueue, 
  setupGracefulShutdownHandlers,
  gracefulShutdown 
} from '@ai-stacks/job-queue';

// Option 1: Automatic handlers (recommended)
initializeJobQueue();
setupGracefulShutdownHandlers(); // Handles SIGTERM, SIGINT

// Option 2: Manual shutdown
await gracefulShutdown(30000); // 30 second timeout
```

## Worker Configuration

```typescript
import { initializeJobQueue } from '@ai-stacks/job-queue';

const { queues, workers } = initializeJobQueue({
  redis: {
    host: 'redis.example.com',
    port: 6379,
    password: 'secret',
    db: 0,
  },
  workers: {
    document: {
      concurrency: 5, // Process 5 docs simultaneously
    },
    ai: {
      concurrency: 2, // Limit AI jobs (expensive)
    },
    webhook: {
      concurrency: 10, // High concurrency for webhooks
    },
  },
});
```

## Job Data Structure

All jobs follow this data structure:

```typescript
interface JobData {
  tenantId: string;        // Required: Multi-tenant isolation
  userId?: string;         // Optional: User who triggered job
  entityType?: string;     // Optional: 'document', 'api_request', etc.
  entityId?: string;       // Optional: Related entity UUID
  payload: Record<string, unknown>; // Job-specific data
  metadata?: Record<string, unknown>; // Additional context
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_HOST` | No | `localhost` | Redis server hostname |
| `REDIS_PORT` | No | `6379` | Redis server port |
| `REDIS_PASSWORD` | No | - | Redis authentication |
| `REDIS_DB` | No | `0` | Redis database number |

## Architecture

```
┌─────────────────┐
│   API Gateway   │
└────────┬────────┘
         │
    ┌────┴────┬────────────┬─────────────┐
    │         │            │             │
    ▼         ▼            ▼             ▼
┌───────┐ ┌───────┐ ┌──────────┐ ┌──────────┐
│Documents│ │AI     │ │Webhooks  │ │Scheduled │
│ Queue  │ │Queue  │ │ Queue    │ │ Queue    │
└───┬───┘ └───┬───┘ └────┬─────┘ └────┬─────┘
    │         │          │            │
    ▼         ▼          ▼            ▼
┌───────┐ ┌───────┐ ┌──────────┐ ┌──────────┐
│Document│ │AI     │ │Webhook   │ │Cron      │
│Worker  │ │Worker │ │ Worker   │ │Worker    │
└───────┘ └───────┘ └──────────┘ └──────────┘
```

## License

MIT

Co-Authored-By: Paperclip <noreply@paperclip.ing>
