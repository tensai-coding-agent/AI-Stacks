import { Worker, Job, Processor } from 'bullmq';
import { 
  QueueName, 
  JobData, 
  JobResult, 
  WebhookJobType,
  getRedisConnection 
} from '../queue.js';

// Simulated webhook delivery
async function sendWebhook(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[WebhookWorker] Sending webhook for job ${job.id}`, {
    url: payload.url,
    event: payload.event,
  });

  try {
    // Simulate HTTP POST request
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simulate occasional failures for retry testing
    if (Math.random() < 0.1) {
      throw new Error('Webhook delivery failed: 500 Internal Server Error');
    }

    return {
      success: true,
      data: {
        url: payload.url,
        event: payload.event,
        statusCode: 200,
        responseTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook delivery failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function retryWebhook(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[WebhookWorker] Retrying webhook for job ${job.id}`, {
    url: payload.url,
    originalJobId: payload.originalJobId,
    attempt: payload.attempt,
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 300));

    return {
      success: true,
      data: {
        url: payload.url,
        event: payload.event,
        statusCode: 200,
        retryAttempt: payload.attempt,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Webhook retry failed',
      processingTime: Date.now() - startTime,
    };
  }
}

// Main webhook processor
const webhookProcessor: Processor<JobData, JobResult> = async (job) => {
  await job.updateProgress(50);

  const result = await (async () => {
    switch (job.name as WebhookJobType) {
      case WebhookJobType.SEND_WEBHOOK:
        return sendWebhook(job);
      
      case WebhookJobType.RETRY_WEBHOOK:
        return retryWebhook(job);
      
      default:
        return {
          success: false,
          error: `Unknown webhook job type: ${job.name}`,
        };
    }
  })();

  await job.updateProgress(result.success ? 100 : 0);
  
  return result;
};

// Webhook Worker configuration
export interface WebhookWorkerConfig {
  concurrency?: number;
}

// Create webhook worker
export function createWebhookWorker(
  config?: WebhookWorkerConfig,
  redisConfig?: { host: string; port: number; password?: string; db?: number }
): Worker<JobData, JobResult> {
  const connection = getRedisConnection(redisConfig ? { redis: redisConfig } : undefined);

  return new Worker<JobData, JobResult>(
    QueueName.WEBHOOKS,
    webhookProcessor,
    {
      connection,
      concurrency: config?.concurrency || 10, // Higher concurrency for webhooks
    }
  );
}

// Worker event handlers
export function setupWebhookWorkerEvents(worker: Worker<JobData, JobResult>): void {
  worker.on('completed', (job, result) => {
    console.log(`[WebhookWorker] Job ${job.id} completed`, {
      url: job.data.payload.url,
      success: result.success,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[WebhookWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('[WebhookWorker] Worker error:', err);
  });
}
