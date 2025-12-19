import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { config } from './config/env.js';
import { createComponentLogger } from './infrastructure/logging/logger.js';
import { makeBigIntSafe } from './utils/api-serializer.js';
import { registerRoutes } from './api/routes/index.js';
import { ForkManager } from './fork/fork-manager.js';
import { Simulator } from './core/simulator.js';

const logger = createComponentLogger('server');

// Extend Fastify types
declare module 'fastify' {
  interface FastifyInstance {
    forkManager: ForkManager;
    simulator: Simulator;
  }
}

export async function createServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: false,
    trustProxy: true,
  });

  // CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Custom serializer for BigInt safety
  fastify.setSerializerCompiler(() => {
    return (data) => {
      const safeData = makeBigIntSafe(data);
      return JSON.stringify(safeData);
    };
  });

  // Create fork manager
  const forkManager = new ForkManager();

  // Create simulator with fork manager dependency
  const simulator = new Simulator({
    getClient: async (networkId: string) => {
      const fork = await forkManager.getOrCreateFork(networkId);
      return fork.client;
    },
  });

  // Decorate fastify instance
  fastify.decorate('forkManager', forkManager);
  fastify.decorate('simulator', simulator);

  // Request logging
  fastify.addHook('onRequest', async (request) => {
    logger.info({ method: request.method, url: request.url }, 'Request received');
  });

  fastify.addHook('onResponse', async (request, reply) => {
    logger.info({
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      responseTime: reply.getResponseTime(),
    }, 'Request completed');
  });

  // Register routes
  await registerRoutes(fastify);

  // Global error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    logger.error({ error: error.message, url: request.url }, 'Request error');

    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: statusCode >= 500 ? 'Internal server error' : error.message,
      timestamp: new Date().toISOString(),
    });
  });

  // 404 handler
  fastify.setNotFoundHandler(async (request, reply) => {
    return reply.status(404).send({
      success: false,
      error: 'Endpoint not found',
      timestamp: new Date().toISOString(),
    });
  });

  return fastify;
}
