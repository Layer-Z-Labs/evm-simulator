import type { FastifyInstance } from 'fastify';
import { HealthResponseSchema } from '../schemas/health.js';

const startTime = Date.now();

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/health',
    {
      schema: {
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const forks = fastify.forkManager.getAllForkStatuses();

      // Determine overall status
      const hasError = Object.values(forks).some(f => f.status === 'error');
      const status = hasError ? 'degraded' : 'healthy';

      return {
        status,
        forks,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        timestamp: new Date().toISOString(),
      };
    }
  );
}
