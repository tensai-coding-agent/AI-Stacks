import { FastifyInstance } from 'fastify';
import { checkCacheHealth } from '../services/cache.js';

export async function healthRoutes(fastify: FastifyInstance) {
  // GET /health - Basic health check
  fastify.get('/', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
    handler: async () => {
      return {
        status: 'healthy',
        service: 'ai-service',
        timestamp: new Date().toISOString(),
      };
    },
  });

  // GET /health/ready - Readiness check (includes dependencies)
  fastify.get('/ready', {
    schema: {
      description: 'Readiness check including dependencies',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            checks: {
              type: 'object',
              properties: {
                cache: {
                  type: 'object',
                  properties: {
                    healthy: { type: 'boolean' },
                    latency: { type: 'number' },
                  },
                },
              },
            },
          },
        },
        503: {
          type: 'object',
          properties: {
            ready: { type: 'boolean' },
            error: { type: 'string' },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const cacheHealth = await checkCacheHealth();
      
      const allHealthy = cacheHealth.healthy;
      
      if (!allHealthy) {
        return reply.code(503).send({
          ready: false,
          checks: {
            cache: cacheHealth,
          },
        });
      }
      
      return {
        ready: true,
        checks: {
          cache: cacheHealth,
        },
      };
    },
  });

  // GET /health/cache - Cache-specific health
  fastify.get('/cache', {
    schema: {
      description: 'Cache health and statistics',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            healthy: { type: 'boolean' },
            latency: { type: 'number' },
          },
        },
      },
    },
    handler: async () => {
      return checkCacheHealth();
    },
  });
}
