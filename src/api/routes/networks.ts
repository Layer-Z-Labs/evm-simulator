import type { FastifyInstance } from 'fastify';
import { Type } from '@sinclair/typebox';
import { NETWORKS } from '../../config/networks.js';

const NetworkSchema = Type.Object({
  id: Type.String(),
  chainId: Type.Number(),
  label: Type.String(),
});

const NetworksResponseSchema = Type.Object({
  networks: Type.Array(NetworkSchema),
});

export async function networksRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/networks',
    {
      schema: {
        response: {
          200: NetworksResponseSchema,
        },
      },
    },
    async () => {
      return {
        networks: NETWORKS.map(n => ({
          id: n.id,
          chainId: n.chainId,
          label: n.label,
        })),
      };
    }
  );
}
