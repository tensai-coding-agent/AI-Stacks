import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import {
  summarizeRequestSchema,
  summarizeResponseSchema,
  asyncJobResponseSchema,
  SummaryStrategy,
  SummaryLength,
  type SummarizeRequest,
  type SummarizeResponse,
  type AsyncJobResponse,
} from '../types/summarization.js';
import { generateSummary, combineDocuments, generateCacheKey } from '../services/summarization.js';
import { getCachedSummary, setCachedSummary } from '../services/cache.js';
import { addJob, QueueName, AIJobType, type JobData } from '@ai-stacks/job-queue';

// Extend Fastify instance to include tenant info
declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    userId?: string;
  }
}

export async function summarizationRoutes(fastify: FastifyInstance) {
  // POST /v1/ai/summarize - Create a summary
  fastify.post('/summarize', {
    schema: {
      description: 'Generate AI-powered summary of text or documents',
      tags: ['AI', 'Summarization'],
      body: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text content to summarize' },
          documentIds: { 
            type: 'array', 
            items: { type: 'string', format: 'uuid' },
            description: 'Document IDs to summarize (up to 10)'
          },
          strategy: { 
            type: 'string', 
            enum: ['extractive', 'abstractive', 'bullets', 'tldr'],
            default: 'abstractive'
          },
          length: { 
            type: 'string', 
            enum: ['short', 'medium', 'long'],
            default: 'medium'
          },
          focus: { type: 'string', description: 'Focus area for summary' },
          async: { type: 'boolean', default: false },
          stream: { type: 'boolean', default: false },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            summary: { type: 'string' },
            strategy: { type: 'string' },
            length: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                inputTokens: { type: 'number' },
                outputTokens: { type: 'number' },
                processingTime: { type: 'number' },
                cached: { type: 'boolean' },
                sourceDocuments: { type: 'array', items: { type: 'string' } },
              },
            },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        202: {
          type: 'object',
          description: 'Async job accepted',
          properties: {
            jobId: { type: 'string' },
            status: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      // Validate request
      const parseResult = summarizeRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.code(400).send({
          error: 'Validation failed',
          details: parseResult.error.format(),
        });
      }

      const body = parseResult.data;
      
      // Must provide either text or documentIds
      if (!body.text && (!body.documentIds || body.documentIds.length === 0)) {
        return reply.code(400).send({
          error: 'Must provide either text or documentIds',
        });
      }

      const tenantId = request.tenantId || 'demo-tenant';
      const userId = request.userId;

      // Get input text (combine documents if provided)
      let inputText = body.text || '';
      
      // In production, fetch documents from database
      if (body.documentIds && body.documentIds.length > 0) {
        // Simulated: in production, fetch from database
        const docTexts = body.documentIds.map(id => `[Content of document ${id}]`);
        inputText = await combineDocuments([inputText, ...docTexts].filter(Boolean));
      }

      // Check cache first
      const cacheKey = generateCacheKey(inputText, body.strategy, body.length, body.focus);
      const cached = await getCachedSummary(cacheKey);

      if (cached && !body.async) {
        // Return cached result
        const response: SummarizeResponse = {
          id: randomUUID(),
          summary: cached.summary,
          strategy: cached.strategy,
          length: cached.length,
          metadata: {
            inputTokens: cached.metadata.inputTokens,
            outputTokens: cached.metadata.outputTokens,
            processingTime: 0, // Cache hit is instant
            cached: true,
            sourceDocuments: body.documentIds,
          },
          createdAt: cached.createdAt,
        };
        
        return response;
      }

      // Async processing requested
      if (body.async) {
        const jobId = await addJob(
          QueueName.AI_PROCESSING,
          AIJobType.SUMMARIZE,
          {
            tenantId,
            userId,
            payload: {
              text: inputText,
              strategy: body.strategy,
              length: body.length,
              focus: body.focus,
              documentIds: body.documentIds,
              cacheKey,
            },
          },
          { priority: 7 }
        );

        const asyncResponse: AsyncJobResponse = {
          jobId,
          status: 'queued',
          message: 'Summary job has been queued for processing',
        };

        return reply.code(202).send(asyncResponse);
      }

      // Synchronous processing
      const startTime = Date.now();
      const result = await generateSummary(inputText, body.strategy, body.length, body.focus);
      
      // Cache the result
      await setCachedSummary(cacheKey, {
        summary: result.summary,
        strategy: body.strategy,
        length: body.length,
        metadata: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          processingTime: result.processingTime,
        },
        createdAt: new Date().toISOString(),
      });

      const response: SummarizeResponse = {
        id: randomUUID(),
        summary: result.summary,
        strategy: body.strategy,
        length: body.length,
        metadata: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          processingTime: Date.now() - startTime,
          cached: false,
          sourceDocuments: body.documentIds,
        },
        createdAt: new Date().toISOString(),
      };

      return response;
    },
  });

  // GET /v1/ai/summarize/strategies - List available strategies
  fastify.get('/summarize/strategies', {
    schema: {
      description: 'Get available summarization strategies',
      tags: ['AI', 'Summarization'],
      response: {
        200: {
          type: 'object',
          properties: {
            strategies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async () => {
      return {
        strategies: [
          {
            id: SummaryStrategy.EXTRACTIVE,
            name: 'Extractive',
            description: 'Selects and combines the most important sentences from the original text',
          },
          {
            id: SummaryStrategy.ABSTRACTIVE,
            name: 'Abstractive',
            description: 'Generates new text that captures the essence of the original content',
          },
          {
            id: SummaryStrategy.BULLETS,
            name: 'Bullet Points',
            description: 'Presents key information as a list of bullet points',
          },
          {
            id: SummaryStrategy.TLDR,
            name: 'TL;DR',
            description: 'Very brief summary for quick understanding',
          },
        ],
      };
    },
  });

  // GET /v1/ai/summarize/lengths - List available lengths
  fastify.get('/summarize/lengths', {
    schema: {
      description: 'Get available summary length options',
      tags: ['AI', 'Summarization'],
      response: {
        200: {
          type: 'object',
          properties: {
            lengths: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  approximateRatio: { type: 'string' },
                },
              },
            },
          },
        },
      },
    },
    handler: async () => {
      return {
        lengths: [
          {
            id: SummaryLength.SHORT,
            name: 'Short',
            description: 'Brief summary (10-20% of original)',
            approximateRatio: '10-20%',
          },
          {
            id: SummaryLength.MEDIUM,
            name: 'Medium',
            description: 'Balanced summary (20-30% of original)',
            approximateRatio: '20-30%',
          },
          {
            id: SummaryLength.LONG,
            name: 'Long',
            description: 'Detailed summary (30-40% of original)',
            approximateRatio: '30-40%',
          },
        ],
      };
    },
  });
}
