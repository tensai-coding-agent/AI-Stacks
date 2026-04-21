/**
 * Core utilities and types for AI Stacks
 * @packageDocumentation
 */

/**
 * Result type for handling operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Creates a successful result
 */
export function ok<T>(data: T): Result<T> {
  return { success: true, data };
}

/**
 * Creates a failed result
 */
export function err<E extends Error>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * sleep - async delay utility
 * @param ms - milliseconds to sleep
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * generateId - simple ID generator
 * Generates a timestamp-based random ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Deep partial type for optional nested objects
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * AI Stacks configuration interface
 */
export interface AIStacksConfig {
  /** Environment mode */
  nodeEnv: 'development' | 'production' | 'test';
  /** Server port */
  port: number;
  /** Database connection string */
  databaseUrl?: string;
  /** Redis connection string */
  redisUrl?: string;
  /** OpenAI API key */
  openaiApiKey?: string;
}

export { version } from './version.js';
Co-Authored-By: Paperclip <noreply@paperclip.ing>
