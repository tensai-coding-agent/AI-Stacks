import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { summarizationRoutes } from './routes/summarization.js';
import { healthRoutes } from './routes/health.js';
import { initializeCache, closeCache } from './services/cache.js';

const PORT = parseInt(process.env.PORT || '3001');
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      transport: process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
    },
    genReqId: () => `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  });

  // Initialize cache (Redis)
  initializeCache();

  // Security plugins
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
      },
    },
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Rate limiting per tenant
  await app.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    redis: process.env.REDIS_URL ? { url: process.env.REDIS_URL } : undefined,
    keyGenerator: (req) => req.headers['x-api-key']?.toString() || req.headers['x-tenant-id']?.toString() || req.ip,
  });

  // OpenAPI documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'AI-Stacks AI Service API',
        description: 'AI-powered document analysis and summarization API',
        version: '1.0.0',
        contact: {
          name: 'AI-Stacks Support',
          email: 'support@ai-stacks.io',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
      },
      servers: [
        {
          url: 'http://localhost:3001/v1',
          description: 'Local development',
        },
        {
          url: 'https://ai.api.ai-stacks.io/v1',
          description: 'Production',
        },
      ],
      components: {
        securitySchemes: {
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
          },
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
      security: [{ apiKey: [] }],
      tags: [
        { name: 'AI', description: 'AI-powered analysis endpoints' },
        { name: 'Summarization', description: 'Text and document summarization' },
        { name: 'Health', description: 'Health and readiness checks' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      persistAuthorization: true,
    },
  });

  // API routes under /v1 prefix
  await app.register(async (v1) => {
    // Health routes
    await v1.register(healthRoutes, { prefix: '/health' });
    
    // AI routes
    await v1.register(summarizationRoutes, { prefix: '/ai' });
  }, { prefix: '/v1' });

  // Root endpoint
  app.get('/', async () => ({
    name: 'AI-Stacks AI Service',
    version: '1.0.0',
    documentation: '/docs',
    endpoints: {
      health: '/v1/health',
      summarize: '/v1/ai/summarize',
      strategies: '/v1/ai/summarize/strategies',
      lengths: '/v1/ai/summarize/lengths',
    },
  }));

  // Graceful shutdown
  app.addHook('onClose', async () => {
    app.log.info('Shutting down AI service...');
    closeCache();
  });

  return app;
}

async function start() {
  try {
    const app = await buildServer();
    
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`AI Service running on http://${HOST}:${PORT}`);
    app.log.info(`API Documentation available at http://${HOST}:${PORT}/docs`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer };
