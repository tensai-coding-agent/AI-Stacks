import { Queue, QueueScheduler, JobCounts } from 'bullmq';
import { 
  QueueName, 
  JobData, 
  JobResult, 
  createQueues,
  getRedisConnection,
  closeRedisConnection 
} from './queue.js';
import { 
  createDocumentWorker, 
  createAIWorker, 
  createWebhookWorker,
  setupDocumentWorkerEvents,
  setupAIWorkerEvents,
  setupWebhookWorkerEvents 
} from './workers/index.js';

export * from './queue.js';
export * from './workers/index.js';

// Worker registry for graceful shutdown
interface WorkerRegistry {
  document?: ReturnType<typeof createDocumentWorker>;
  ai?: ReturnType<typeof createAIWorker>;
  webhook?: ReturnType<typeof createWebhookWorker>;
}

const workers: WorkerRegistry = {};

// Queue registry
let queues: Record<QueueName, Queue<JobData, JobResult>> | null = null;

/**
 * Initialize all queues and workers
 */
export function initializeJobQueue(config?: {
  redis?: { host: string; port: number; password?: string; db?: number };
  workers?: {
    document?: { concurrency?: number };
    ai?: { concurrency?: number };
    webhook?: { concurrency?: number };
  };
}): {
  queues: Record<QueueName, Queue<JobData, JobResult>>;
  workers: WorkerRegistry;
} {
  // Initialize queues
  queues = createQueues(config);

  // Initialize workers
  workers.document = createDocumentWorker(config?.workers?.document, config?.redis);
  workers.ai = createAIWorker(config?.workers?.ai, config?.redis);
  workers.webhook = createWebhookWorker(config?.workers?.webhook, config?.redis);

  // Setup event handlers
  if (workers.document) setupDocumentWorkerEvents(workers.document);
  if (workers.ai) setupAIWorkerEvents(workers.ai);
  if (workers.webhook) setupWebhookWorkerEvents(workers.webhook);

  console.log('[JobQueue] Initialized all queues and workers');

  return { queues, workers };
}

/**
 * Get queue instance
 */
export function getQueue(name: QueueName): Queue<JobData, JobResult> {
  if (!queues) {
    throw new Error('Job queue not initialized. Call initializeJobQueue first.');
  }
  return queues[name];
}

/**
 * Get all queue metrics for monitoring
 */
export async function getQueueMetrics(): Promise<
  Record<QueueName, { counts: JobCounts; delayedCount: number; waitingCount: number }>
> {
  if (!queues) {
    throw new Error('Job queue not initialized');
  }

  const metrics = {} as Record<QueueName, { counts: JobCounts; delayedCount: number; waitingCount: number }>;

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts();
    const delayed = await queue.getDelayedCount();
    const waiting = await queue.getWaitingCount();

    metrics[name as QueueName] = {
      counts,
      delayedCount: delayed,
      waitingCount: waiting,
    };
  }

  return metrics;
}

/**
 * Format metrics for health checks
 */
export async function getHealthStatus(): Promise<{
  healthy: boolean;
  queues: Record<string, { status: string; pending: number; failed: number }>;
  workers: { document: boolean; ai: boolean; webhook: boolean };
}> {
  const metrics = await getQueueMetrics();

  const queueStatus: Record<string, { status: string; pending: number; failed: number }> = {};
  let totalFailed = 0;

  for (const [name, data] of Object.entries(metrics)) {
    const failed = data.counts.failed || 0;
    totalFailed += failed;
    
    queueStatus[name] = {
      status: failed > 100 ? 'degraded' : 'healthy',
      pending: data.counts.waiting + data.counts.delayed + (data.counts.paused || 0),
      failed,
    };
  }

  return {
    healthy: totalFailed < 50,
    queues: queueStatus,
    workers: {
      document: !!workers.document?.isRunning(),
      ai: !!workers.ai?.isRunning(),
      webhook: !!workers.webhook?.isRunning(),
    },
  };
}

/**
 * Graceful shutdown - pause workers and close connections
 */
export async function gracefulShutdown(timeoutMs: number = 30000): Promise<void> {
  console.log('[JobQueue] Starting graceful shutdown...');

  const shutdownPromises: Promise<void>[] = [];

  // Pause all workers (stop accepting new jobs)
  if (workers.document?.isRunning()) {
    shutdownPromises.push(
      workers.document.pause().then(() => {
        console.log('[JobQueue] Document worker paused');
      })
    );
  }

  if (workers.ai?.isRunning()) {
    shutdownPromises.push(
      workers.ai.pause().then(() => {
        console.log('[JobQueue] AI worker paused');
      })
    );
  }

  if (workers.webhook?.isRunning()) {
    shutdownPromises.push(
      workers.webhook.pause().then(() => {
        console.log('[JobQueue] Webhook worker paused');
      })
    );
  }

  // Wait for workers to pause (with timeout)
  await Promise.race([
    Promise.all(shutdownPromises),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Worker pause timeout')), timeoutMs)
    ),
  ]);

  // Close all workers
  const closePromises: Promise<void>[] = [];

  if (workers.document) {
    closePromises.push(workers.document.close());
  }
  if (workers.ai) {
    closePromises.push(workers.ai.close());
  }
  if (workers.webhook) {
    closePromises.push(workers.webhook.close());
  }

  await Promise.all(closePromises);
  console.log('[JobQueue] All workers closed');

  // Close queues
  if (queues) {
    await Promise.all(Object.values(queues).map(q => q.close()));
    console.log('[JobQueue] All queues closed');
  }

  // Close Redis connection
  closeRedisConnection();
  console.log('[JobQueue] Redis connection closed');

  console.log('[JobQueue] Graceful shutdown complete');
}

/**
 * Setup graceful shutdown handlers for process signals
 */
export function setupGracefulShutdownHandlers(): void {
  const shutdown = async (signal: string) => {
    console.log(`[JobQueue] Received ${signal}, starting graceful shutdown...`);
    try {
      await gracefulShutdown();
      process.exit(0);
    } catch (err) {
      console.error('[JobQueue] Graceful shutdown failed:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

/**
 * Add a job to a queue
 */
export async function addJob(
  queueName: QueueName,
  jobName: string,
  data: JobData,
  options?: { priority?: number; delay?: number; attempts?: number }
): Promise<string> {
  const queue = getQueue(queueName);
  
  const job = await queue.add(jobName, data, {
    priority: options?.priority,
    delay: options?.delay,
    attempts: options?.attempts,
  });

  return job.id || '';
}
