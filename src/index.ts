import { config } from './config/env.js';
import { logger, createComponentLogger } from './infrastructure/logging/logger.js';
import { createServer } from './server.js';

const appLogger = createComponentLogger('main');

let server: Awaited<ReturnType<typeof createServer>> | null = null;

async function start() {
  appLogger.info({
    version: '1.0.0',
    nodeVersion: process.version,
    environment: config.nodeEnv,
  }, 'Starting Asset Delta Simulator');

  try {
    server = await createServer();

    await server.listen({
      host: config.host,
      port: config.port,
    });

    appLogger.info({
      host: config.host,
      port: config.port,
    }, 'Asset Delta Simulator started');

    appLogger.info({
      simulate: `http://${config.host}:${config.port}/simulate`,
      health: `http://${config.host}:${config.port}/health`,
      networks: `http://${config.host}:${config.port}/networks`,
    }, 'Endpoints ready');

  } catch (err) {
    appLogger.error({ error: err }, 'Failed to start server');
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  appLogger.info({ signal }, 'Shutdown signal received');

  try {
    if (server) {
      // Shutdown fork manager first
      await server.forkManager.shutdown();

      // Then close HTTP server
      await server.close();

      appLogger.info('Server closed gracefully');
    }
    process.exit(0);
  } catch (err) {
    appLogger.error({ error: err }, 'Error during shutdown');
    process.exit(1);
  }
}

// Signal handlers
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Uncaught error handlers
process.on('uncaughtException', (err) => {
  appLogger.error({ error: err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  appLogger.error({ error: reason }, 'Unhandled rejection');
  process.exit(1);
});

// Start
start();
