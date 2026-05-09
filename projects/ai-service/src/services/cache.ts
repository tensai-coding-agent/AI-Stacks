import Redis from 'ioredis';
import type { CacheEntry, SummaryStrategyType, SummaryLengthType } from '../types/summarization.js';

// Redis connection
let redis: Redis | null = null;

export function initializeCache(config?: { 
  host?: string; 
  port?: number; 
  password?: string;
  db?: number;
}): Redis {
  if (!redis) {
    redis = new Redis({
      host: config?.host || process.env.REDIS_HOST || 'localhost',
      port: config?.port || parseInt(process.env.REDIS_PORT || '6379'),
      password: config?.password || process.env.REDIS_PASSWORD,
      db: config?.db || parseInt(process.env.REDIS_DB || '0'),
    });
  }
  return redis;
}

export function getCache(): Redis {
  if (!redis) {
    throw new Error('Cache not initialized. Call initializeCache first.');
  }
  return redis;
}

export function closeCache(): void {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}

// Cache TTL in seconds (1 hour default)
const DEFAULT_TTL = 3600;

export async function getCachedSummary(cacheKey: string): Promise<CacheEntry | null> {
  const cache = getCache();
  
  try {
    const cached = await cache.get(cacheKey);
    if (!cached) return null;
    
    return JSON.parse(cached) as CacheEntry;
  } catch (error) {
    console.error('[Cache] Error retrieving from cache:', error);
    return null;
  }
}

export async function setCachedSummary(
  cacheKey: string,
  entry: CacheEntry,
  ttlSeconds: number = DEFAULT_TTL
): Promise<void> {
  const cache = getCache();
  
  try {
    await cache.setex(cacheKey, ttlSeconds, JSON.stringify(entry));
  } catch (error) {
    console.error('[Cache] Error storing in cache:', error);
  }
}

export async function invalidateCache(cacheKey: string): Promise<void> {
  const cache = getCache();
  
  try {
    await cache.del(cacheKey);
  } catch (error) {
    console.error('[Cache] Error invalidating cache:', error);
  }
}

// Health check
export async function checkCacheHealth(): Promise<{ healthy: boolean; latency: number }> {
  const cache = getCache();
  const start = Date.now();
  
  try {
    await cache.ping();
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
    };
  }
}

// Cache stats
export async function getCacheStats(): Promise<{
  hits: number;
  misses: number;
  keys: number;
}> {
  const cache = getCache();
  
  try {
    const info = await cache.info('stats');
    const keys = await cache.dbsize();
    
    // Parse keyspace hits/misses from info
    const keyspaceHits = info.match(/keyspace_hits:(\d+)/)?.[1] || '0';
    const keyspaceMisses = info.match(/keyspace_misses:(\d+)/)?.[1] || '0';
    
    return {
      hits: parseInt(keyspaceHits),
      misses: parseInt(keyspaceMisses),
      keys,
    };
  } catch (error) {
    console.error('[Cache] Error getting stats:', error);
    return { hits: 0, misses: 0, keys: 0 };
  }
}
