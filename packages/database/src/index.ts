import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index.js';

export interface DatabaseConfig {
  url: string;
  maxConnections?: number;
  idleTimeout?: number;
}

let connection: postgres.Sql | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Create database connection
 */
export function createConnection(config: DatabaseConfig) {
  const client = postgres(config.url, {
    max: config.maxConnections ?? 20,
    idle_timeout: config.idleTimeout ?? 30,
    connect_timeout: 10,
  });

  return client;
}

/**
 * Initialize database with Drizzle ORM
 */
export function initializeDatabase(client: postgres.Sql) {
  const database = drizzle(client, { schema });
  connection = client;
  db = database;
  return database;
}

/**
 * Get database instance (must call initializeDatabase first)
 */
export function getDatabase() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase first.');
  }
  return db;
}

/**
 * Close database connection
 */
export async function closeConnection() {
  if (connection) {
    await connection.end();
    connection = null;
    db = null;
  }
}

/**
 * Check database connectivity
 */
export async function checkHealth(client: postgres.Sql): Promise<{ healthy: boolean; latency: number; error?: string }> {
  const start = Date.now();
  try {
    await client`SELECT 1`;
    return {
      healthy: true,
      latency: Date.now() - start,
    };
  } catch (err) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// Re-export schema
export { schema };
export * from './schema/index.js';
