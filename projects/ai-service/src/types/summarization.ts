import { z } from 'zod';

// Summary strategies
export const SummaryStrategy = {
  EXTRACTIVE: 'extractive',
  ABSTRACTIVE: 'abstractive',
  BULLETS: 'bullets',
  TLDR: 'tldr',
} as const;

export type SummaryStrategyType = typeof SummaryStrategy[keyof typeof SummaryStrategy];

// Summary lengths
export const SummaryLength = {
  SHORT: 'short',
  MEDIUM: 'medium',
  LONG: 'long',
} as const;

export type SummaryLengthType = typeof SummaryLength[keyof typeof SummaryLength];

// Zod schemas for validation
export const summarizeRequestSchema = z.object({
  // Input can be text directly or document IDs
  text: z.string().min(1).max(100000).optional(),
  documentIds: z.array(z.string().uuid()).max(10).optional(),
  
  // Configuration
  strategy: z.enum([
    SummaryStrategy.EXTRACTIVE,
    SummaryStrategy.ABSTRACTIVE,
    SummaryStrategy.BULLETS,
    SummaryStrategy.TLDR,
  ]).default(SummaryStrategy.ABSTRACTIVE),
  
  length: z.enum([
    SummaryLength.SHORT,
    SummaryLength.MEDIUM,
    SummaryLength.LONG,
  ]).default(SummaryLength.MEDIUM),
  
  // Optional focus areas
  focus: z.string().max(500).optional(),
  
  // Processing mode
  async: z.boolean().default(false),
  
  // Streaming (for future implementation)
  stream: z.boolean().default(false),
});

export const summarizeResponseSchema = z.object({
  id: z.string().uuid(),
  summary: z.string(),
  strategy: z.enum([
    SummaryStrategy.EXTRACTIVE,
    SummaryStrategy.ABSTRACTIVE,
    SummaryStrategy.BULLETS,
    SummaryStrategy.TLDR,
  ]),
  length: z.enum([
    SummaryLength.SHORT,
    SummaryLength.MEDIUM,
    SummaryLength.LONG,
  ]),
  metadata: z.object({
    inputTokens: z.number().int(),
    outputTokens: z.number().int(),
    processingTime: z.number().int(), // milliseconds
    cached: z.boolean(),
    sourceDocuments: z.array(z.string().uuid()).optional(),
  }),
  createdAt: z.string().datetime(),
});

export const asyncJobResponseSchema = z.object({
  jobId: z.string(),
  status: z.enum(['queued', 'processing', 'completed', 'failed']),
  message: z.string(),
});

// Type exports
export type SummarizeRequest = z.infer<typeof summarizeRequestSchema>;
export type SummarizeResponse = z.infer<typeof summarizeResponseSchema>;
export type AsyncJobResponse = z.infer<typeof asyncJobResponseSchema>;

// Cache entry structure
export interface CacheEntry {
  summary: string;
  strategy: SummaryStrategyType;
  length: SummaryLengthType;
  metadata: {
    inputTokens: number;
    outputTokens: number;
    processingTime: number;
  };
  createdAt: string;
}

// Internal summary result
export interface SummaryResult {
  summary: string;
  inputTokens: number;
  outputTokens: number;
  processingTime: number;
}
