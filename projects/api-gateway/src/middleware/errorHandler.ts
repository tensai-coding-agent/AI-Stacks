import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  request.log.error({
    err: error,
    requestId: request.id,
    path: request.url,
    method: request.method
  }, 'Request error');

  // Handle Zod validation errors
  if (error.code === 'FST_ERR_VALIDATION') {
    return reply.status(400).send({
      error: 'Validation Error',
      message: error.message,
      statusCode: 400,
      requestId: request.id
    });
  }

  // Handle rate limit errors
  if (error.code === 'FST_ERR_RATE_LIMIT') {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
      statusCode: 429,
      requestId: request.id,
      retryAfter: reply.getHeader('retry-after')
    });
  }

  // Handle 404
  if (error.code === 'FST_ERR_NOT_FOUND') {
    return reply.status(404).send({
      error: 'Not Found',
      message: `Route ${request.method} ${request.url} not found`,
      statusCode: 404,
      requestId: request.id
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal Server Error'
    : error.message;

  return reply.status(statusCode).send({
    error: statusCode === 500 ? 'Internal Server Error' : error.name || 'Error',
    message,
    statusCode,
    requestId: request.id,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
}
