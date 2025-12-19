import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SimulateRequestSchema, SimulateResponseSchema, type SimulateRequestBody } from '../schemas/simulate.js';
import { ErrorResponseSchema } from '../schemas/error.js';
import { getNetwork } from '../../config/networks.js';
import { createErrorResponse } from '../../types/simulation.js';

export async function simulateRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: SimulateRequestBody }>(
    '/simulate',
    {
      schema: {
        body: SimulateRequestSchema,
        response: {
          200: SimulateResponseSchema,
          400: ErrorResponseSchema,
          503: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { networkId, tx } = request.body;

      // Validate network exists
      const network = getNetwork(networkId);
      if (!network) {
        return reply.status(400).send(createErrorResponse(`Unknown network: ${networkId}`));
      }

      try {
        const result = await fastify.simulator.simulate(networkId, tx);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Simulation failed';
        if (message.includes('Failed to start fork')) {
          return reply.status(503).send(createErrorResponse(message));
        }
        return reply.status(400).send(createErrorResponse(message));
      }
    }
  );
}
