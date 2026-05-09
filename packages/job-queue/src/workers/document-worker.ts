import { Worker, Job, Processor } from 'bullmq';
import Redis from 'ioredis';
import { 
  QueueName, 
  JobData, 
  JobResult, 
  DocumentJobType,
  getRedisConnection,
  closeRedisConnection 
} from '../queue.js';

// Simulated document processors (actual implementation would use pdf-parse, mammoth, etc.)
async function processPdfExtraction(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[DocumentWorker] Processing PDF extraction for job ${job.id}`, {
    documentId: payload.documentId,
    filename: payload.filename,
  });

  try {
    // Simulate processing time based on file size
    const fileSize = (payload.fileSize as number) || 100000;
    const processingTime = Math.min(5000, Math.max(500, fileSize / 10000));
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Simulate text extraction
    const extractedText = `[Extracted text from PDF: ${payload.filename}]\n\n` +
      `This is simulated extracted text content. In production, this would be ` +
      `actual text extracted from the PDF document using pdf-parse or similar library.\n\n` +
      `Document ID: ${payload.documentId}\n` +
      `Pages: ${payload.pageCount || 'unknown'}\n` +
      `Word count: ${payload.wordCount || 'unknown'}`;

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        extractedText,
        pageCount: payload.pageCount || 1,
        wordCount: payload.wordCount || extractedText.split(/\s+/).length,
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'PDF extraction failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processDocxExtraction(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[DocumentWorker] Processing DOCX extraction for job ${job.id}`, {
    documentId: payload.documentId,
    filename: payload.filename,
  });

  try {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 800));

    const extractedText = `[Extracted text from DOCX: ${payload.filename}]\n\n` +
      `This is simulated extracted text content from a Word document. ` +
      `In production, this would use mammoth or docx libraries to extract text.\n\n` +
      `Document ID: ${payload.documentId}`;

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        extractedText,
        wordCount: extractedText.split(/\s+/).length,
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'DOCX extraction failed',
      processingTime: Date.now() - startTime,
    };
  }
}

async function processOcr(job: Job<JobData>): Promise<JobResult> {
  const startTime = Date.now();
  const { payload } = job.data;
  
  console.log(`[DocumentWorker] Processing OCR for job ${job.id}`, {
    documentId: payload.documentId,
    imageType: payload.imageType,
  });

  try {
    // OCR is more intensive
    await new Promise(resolve => setTimeout(resolve, 2000));

    return {
      success: true,
      data: {
        documentId: payload.documentId,
        extractedText: `[OCR result for image: ${payload.filename || 'unknown'}]\n\n` +
          'Simulated OCR text extraction. In production, this would use Tesseract or cloud OCR.',
        confidence: 0.95,
        processingTime: Date.now() - startTime,
      },
      processingTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OCR processing failed',
      processingTime: Date.now() - startTime,
    };
  }
}

// Main document processor
const documentProcessor: Processor<JobData, JobResult> = async (job) => {
  // Update progress
  await job.updateProgress(10);

  const result = await (async () => {
    switch (job.name as DocumentJobType) {
      case DocumentJobType.PARSE_PDF:
      case DocumentJobType.EXTRACT_TEXT:
        await job.updateProgress(50);
        return processPdfExtraction(job);
      
      case DocumentJobType.PARSE_DOCX:
        await job.updateProgress(50);
        return processDocxExtraction(job);
      
      case DocumentJobType.OCR_IMAGE:
        await job.updateProgress(50);
        return processOcr(job);
      
      default:
        return {
          success: false,
          error: `Unknown document job type: ${job.name}`,
        };
    }
  })();

  // Final progress
  await job.updateProgress(result.success ? 100 : 0);
  
  return result;
};

// Worker configuration
export interface WorkerConfig {
  concurrency?: number;
  limiter?: {
    max: number;
    duration: number;
  };
}

// Create document worker
export function createDocumentWorker(
  config?: WorkerConfig,
  redisConfig?: { host: string; port: number; password?: string; db?: number }
): Worker<JobData, JobResult> {
  const connection = getRedisConnection(redisConfig ? { redis: redisConfig } : undefined);

  return new Worker<JobData, JobResult>(
    QueueName.DOCUMENTS,
    documentProcessor,
    {
      connection,
      concurrency: config?.concurrency || 3,
      limiter: config?.limiter || {
        max: 10,
        duration: 1000,
      },
    }
  );
}

// Worker event handlers
export function setupDocumentWorkerEvents(worker: Worker<JobData, JobResult>): void {
  worker.on('completed', (job, result) => {
    console.log(`[DocumentWorker] Job ${job.id} completed`, {
      success: result.success,
      processingTime: result.processingTime,
    });
  });

  worker.on('failed', (job, err) => {
    console.error(`[DocumentWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on('progress', (job, progress) => {
    console.log(`[DocumentWorker] Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (err) => {
    console.error('[DocumentWorker] Worker error:', err);
  });
}
