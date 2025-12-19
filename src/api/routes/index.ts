import type { FastifyInstance } from 'fastify';
import { simulateRoutes } from './simulate.js';
import { healthRoutes } from './health.js';
import { networksRoutes } from './networks.js';
import { adminRoutes } from './admin.js';

export async function registerRoutes(fastify: FastifyInstance) {
  await fastify.register(simulateRoutes);
  await fastify.register(healthRoutes);
  await fastify.register(networksRoutes);
  await fastify.register(adminRoutes);
}
