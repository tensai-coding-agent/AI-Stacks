import { Worker, Job, Processor } from 'bullmq';
import { 
  QueueName, 
  JobData, 
  JobResult, 
  AIJobType,
  getRedisConnection 
} from '../queue.js';

// Simulated AI processors (actual implementation would call OpenAI, Anthropic, etc.)
async function processSummarization(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[AIWorker] Processing summarization for job ${job.id}`, {
    documentId: payload.documentId,
    strategy: payload.strategy,
    length: payload.length,
  });

  try {
    // Simulate AI processing time (LLM calls take time)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const strategies: Record<string, string> = {
      extractive: 'Key sentences extracted from the document...',
      abstractive: 'A generated summary synthesizing the main points...',
      bullets: '• Point 1\n• Point 2\n• Point 3',
      tldr: 'TL;DR: Main conclusion in 1-2 sentences.',
    };

    const lengthModifiers: Record<string, string> = {
      short: ' (concise)',
      medium: '',
      long: ' (detailed)',
    };

    const strategy = (payload.strategy as string) || 'abstractive';
    const length = (payload.length as string) || 'medium';

    const summary = `[${strategy.toUpperCase()} Summary${lengthModifiers[length]}]\n\n` +
      strategies[strategy] || strategies.abstractive;

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        summary,
        strategy,
        length,
        tokensUsed: {
          input: 1500,
          output: 250,
          total: 1750,
        },
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Summarization failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processEntityExtraction(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[AIWorker] Processing entity extraction for job ${job.id}`, {
    documentId: payload.documentId,
    entityTypes: payload.entityTypes,
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 2500));

    const entities = [
      { type: 'PERSON', text: 'John Smith', confidence: 0.98 },
      { type: 'ORGANIZATION', text: 'Acme Corp', confidence: 0.95 },
      { type: 'DATE', text: 'January 15, 2024', confidence: 0.99 },
      { type: 'MONEY', text: '$50,000', confidence: 0.97 },
    ];

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        entities,
        entityCount: entities.length,
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Entity extraction failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processClassification(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[AIWorker] Processing classification for job ${job.id}`, {
    documentId: payload.documentId,
    categories: payload.categories,
  });

  try {
    await new Promise(resolve => setTimeout(resolve, 1500));

    const classifications = [
      { category: 'contract', confidence: 0.89 },
      { category: 'legal', confidence: 0.76 },
      { category: 'business', confidence: 0.65 },
    ];

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        classifications,
        primaryCategory: classifications[0],
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Classification failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processEmbeddings(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[AIWorker] Processing embeddings generation for job ${job.id}`, {
    documentId: payload.documentId,
    chunks: payload.chunks,
  });

  try {
    // Simulate embedding generation (can be batched)
    const chunks = (payload.chunks as number) || 1;
    await new Promise(resolve => setTimeout(resolve, 1000 * chunks));

    // Simulated 1536-dimensional embedding vector
    const embedding = Array.from({ length: 1536 }, () => (Math.random() - 0.5) * 2);

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        embedding,
        dimensions: embedding.length,
        chunks,
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Embedding generation failed',
      processingTime: Date.now() - startTime,
    };
  }
}

// Main AI processor
const aiProcessor: Processor<JobData, JobResult> = async (job) => {
  await job.updateProgress(10);

  const result = await (async () => {
    switch (job.name as AIJobType) {
      case AIJobType.SUMMARIZE:
        await job.updateProgress(30);
        return processSummarization(job);
      
      case AIJobType.EXTRACT_ENTITIES:
        await job.updateProgress(30);
        return processEntityExtraction(job);
      
      case AIJobType.CLASSIFY:
        await job.updateProgress(30);
        return processClassification(job);
      
      case AIJobType.GENERATE_EMBEDDINGS:
        await job.updateProgress(30);
        return processEmbeddings(job);
      
      default:
        return {
          success: false,
          error: `Unknown AI job type: ${job.name}`,
        };
    }
  })();

  await job.updateProgress(result.success ? 100 : 0);
  
  return result;
};

// AI Worker configuration
export interface AIWorkerConfig {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

// Create AI worker
export function createAIWorker(
  config?: AIWorkerConfig,
  redisConfig?: { host: string; port: number; password?: string; db?: number }
): Worker<JobData, JobResult> {
  const connection = getRedisConnection(redisConfig ? { redis: redisConfig } : undefined);

  return new Worker<JobData, JobResult>(
    QueueName.AI_PROCESSING,
    aiProcessor,
    {
      connection,
      concurrency: config?.concurrency || 2, // Lower concurrency for AI jobs (expensive)
      limiter: config?.limiter || {
        max: 5,
        duration: 1000,
      },
    }
  );
}

// Worker event handlers
export function setupAIWorkerEvents(worker: Worker<JobData, JobResult>): void {
  worker.on('completed', (job, result) => {
    console.log(`[AIWorker] Job ${job.id} completed`, {
      type: job.name,
      success: result.success,
      processingTime: result.processingTime,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[AIWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[AIWorker] Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (err) => {
    console.error('[AIWorker] Worker error:', err);
  });
}
