# AI-Stacks API Gateway

Enterprise-grade API Gateway for the AI-Stacks Core Platform.

## Features

- **Fastify-based**: High-performance Node.js framework
- **OpenAPI 3.1**: Full API specification with Swagger UI
- **Security**: Helmet, CORS, rate limiting, JWT/API key auth
- **Observability**: Structured logging with Pino, health checks, metrics
- **Multi-tenant**: Built-in tenant isolation support

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Edit .env with your configuration

# Run in development mode
pnpm dev

# Or build and start
pnpm build
pnpm start
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:3000/docs
- OpenAPI JSON: http://localhost:3000/documentation/json

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/health` | Basic liveness check |
| `GET /v1/health/ready` | Readiness with dependency checks |
| `GET /v1/health/metrics` | Detailed metrics (memory, CPU) |

## Project Structure

```
src/
├── index.ts              # Main entry point
├── middleware/           # Fastify hooks & handlers
│   ├── errorHandler.ts   # Global error handling
│   └── requestLogger.ts  # Request logging
├── routes/               # Route definitions
│   └── health.ts         # Health check routes
├── types/                # TypeScript types
└── utils/                # Utility functions
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 3000 |
| `HOST` | Bind address | 0.0.0.0 |
| `LOG_LEVEL` | Pino log level | info |
| `CORS_ORIGIN` | CORS allowed origins | * |
| `RATE_LIMIT_MAX` | Max requests per window | 100 |
| `RATE_LIMIT_WINDOW` | Rate limit time window | 1 minute |
| `REDIS_URL` | Redis connection URL | - |
| `DATABASE_URL` | PostgreSQL connection URL | - |
| `JWT_SECRET` | JWT signing secret | - |

## Development

```bash
# Run tests
pnpm test

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Integration

This API Gateway is the foundation for:
- [TEN-103](/TEN/issues/TEN-103) - Document Processing
- [TEN-105](/TEN/issues/TEN-105) - Database Layer
- [TEN-106](/TEN/issues/TEN-106) - AI Provider Abstraction
- [TEN-107](/TEN/issues/TEN-107) - Job Queue System

---

Co-Authored-By: Paperclip <noreply@paperclip.ing>
