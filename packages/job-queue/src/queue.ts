import { Queue, QueueOptions, JobsOptions, Job } from 'bullmq';
import Redis from 'ioredis';

export interface QueueConfig {
  redis: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
  prefix?: string;
}

export interface JobData {
  tenantId: string;
  userId?: string;
  entityType?: string;
  entityId?: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface JobResult {
  success: boolean;
  data?: unknown;
  error?: string;
  processingTime?: number;
}

// Redis connection singleton
let redisConnection: Redis | null = null;

export function getRedisConnection(config?: QueueConfig): Redis {
  if (!redisConnection) {
    const redisConfig = config?.redis || {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    };

    redisConnection = new Redis({
      host: redisConfig.host,
      port: redisConfig.port,
      password: redisConfig.password,
      db: redisConfig.db,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return redisConnection;
}

export function closeRedisConnection(): void {
  if (redisConnection) {
    redisConnection.disconnect();
    redisConnection = null;
  }
}

// Queue names enum
export enum QueueName {
  DOCUMENTS = 'documents',
  AI_PROCESSING = 'ai-processing',
  WEBHOOKS = 'webhooks',
  NOTIFICATIONS = 'notifications',
  SCHEDULED = 'scheduled',
}

// Job types per queue
export enum DocumentJobType {
  EXTRACT_TEXT = 'extract-text',
  PARSE_PDF = 'parse-pdf',
  PARSE_DOCX = 'parse-docx',
  OCR_IMAGE = 'ocr-image',
}

export enum AIJobType {
  SUMMARIZE = 'summarize',
  EXTRACT_ENTITIES = 'extract-entities',
  CLASSIFY = 'classify',
  GENERATE_EMBEDDINGS = 'generate-embeddings',
}

export enum WebhookJobType {
  SEND_WEBHOOK = 'send-webhook',
  RETRY_WEBHOOK = 'retry-webhook',
}

// Priority levels (higher = more important)
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 8,
  CRITICAL = 10,
}

// Default job options
export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 7 * 24 * 60 * 60, // 7 days
  },
  removeOnFail: {
    count: 500,
    age: 30 * 24 * 60 * 60, // 30 days
  },
};

// Queue factory function
export function createQueue(name: QueueName, config?: QueueConfig): Queue<JobData, JobResult> {
  const connection = getRedisConnection(config);
  const prefix = config?.prefix || 'bull';

  return new Queue<JobData, JobResult>(name, {
    connection,
    prefix,
    defaultJobOptions,
  });
}

// Get all queues
export function createQueues(config?: QueueConfig): Record<QueueName, Queue<JobData, JobResult>> {
  return {
    [QueueName.DOCUMENTS]: createQueue(QueueName.DOCUMENTS, config),
    [QueueName.AI_PROCESSING]: createQueue(QueueName.AI_PROCESSING, config),
    [QueueName.WEBHOOKS]: createQueue(QueueName.WEBHOOKS, config),
    [QueueName.NOTIFICATIONS]: createQueue(QueueName.NOTIFICATIONS, config),
    [QueueName.SCHEDULED]: createQueue(QueueName.SCHEDULED, config),
  };
}

// Type guards for job data
export function isDocumentJob(job: Job<JobData>): boolean {
  return Object.values(DocumentJobType).includes(job.name as DocumentJobType);
}

export function isAIJob(job: Job<JobData>): boolean {
  return Object.values(AIJobType).includes(job.name as AIJobType);
}

export function isWebhookJob(job: Job<JobData>): boolean {
  return Object.values(WebhookJobType).includes(job.name as WebhookJobType);
}
