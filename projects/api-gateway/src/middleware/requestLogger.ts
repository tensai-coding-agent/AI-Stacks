import type { FastifyRequest, FastifyReply } from 'fastify';

const requestStartTimes = new WeakMap<FastifyRequest, number>();

export async function requestLogger(request: FastifyRequest, reply: FastifyReply) {
  const startTime = Date.now();
  requestStartTimes.set(request, startTime);
  
  request.log.info({
    requestId: request.id,
    method: request.method,
    url: request.url,
    remoteAddress: request.ip,
    userAgent: request.headers['user-agent'],
    contentType: request.headers['content-type'],
    apiKey: request.headers['x-api-key'] ? '[REDACTED]' : undefined
  }, 'Incoming request');
}

export function createOnSendHook() {
  return async (request: FastifyRequest, reply: FastifyReply, payload: unknown) => {
    const startTime = requestStartTimes.get(request);
    if (startTime) {
      const duration = Date.now() - startTime;
      requestStartTimes.delete(request);
      
      request.log.info({
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration,
        contentLength: reply.getHeader('content-length'),
        responseTime: `${duration}ms`
      }, 'Request completed');
    }
  };
}
