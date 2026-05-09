import type { FastifyInstance, FastifyPluginOptions } from 'fastify';

export async function healthRoutes(
  app: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Health check - basic liveness
  app.get('/', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  }));

  // Readiness check - includes dependencies
  app.get('/ready', async () => {
    const checks: Record<string, { status: string; latency: number }> = {};
    
    // Check Redis if configured
    if (process.env.REDIS_URL) {
      const start = Date.now();
      try {
        // TODO: Add actual Redis health check (TEN-107)
        checks.redis = { status: 'unknown', latency: 0 };
      } catch {
        checks.redis = { status: 'unhealthy', latency: Date.now() - start };
      }
    }

    // Check database if configured
    if (process.env.DATABASE_URL) {
      const start = Date.now();
      try {
        // TODO: Add actual DB health check (TEN-105)
        checks.database = { status: 'unknown', latency: 0 };
      } catch {
        checks.database = { status: 'unhealthy', latency: Date.now() - start };
      }
    }

    const allHealthy = Object.values(checks).every(c => c.status !== 'unhealthy');

    return {
      status: allHealthy ? 'ready' : 'not ready',
      timestamp: new Date().toISOString(),
      checks,
      version: '1.0.0'
    };
  });

  // Detailed health metrics
  app.get('/metrics', async () => ({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  }));
}
