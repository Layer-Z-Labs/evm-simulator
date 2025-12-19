import { pino, Logger } from 'pino';
import { config } from '../../config/env.js';

const isDevelopment = config.nodeEnv === 'development';

export const logger: Logger = pino({
  level: config.logLevel,
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss.l',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

export function createComponentLogger(component: string) {
  return logger.child({ component });
}
