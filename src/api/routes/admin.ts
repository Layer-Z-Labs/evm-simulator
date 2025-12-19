import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Type, Static } from '@sinclair/typebox';
import { getNetwork } from '../../config/networks.js';

const RefreshForkRequestSchema = Type.Object({
  networkId: Type.String({ minLength: 1 }),
});

const RefreshForkResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

type RefreshForkBody = Static<typeof RefreshForkRequestSchema>;

export async function adminRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RefreshForkBody }>(
    '/admin/refresh-fork',
    {
      schema: {
        body: RefreshForkRequestSchema,
        response: {
          200: RefreshForkResponseSchema,
          400: RefreshForkResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { networkId } = request.body;

      const network = getNetwork(networkId);
      if (!network) {
        return reply.status(400).send({
          success: false,
          message: `Unknown network: ${networkId}`,
        });
      }

      try {
        await fastify.forkManager.refreshFork(networkId);
        return {
          success: true,
          message: 'Fork refreshed',
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Refresh failed';
        return reply.status(400).send({
          success: false,
          message,
        });
      }
    }
  );
}
