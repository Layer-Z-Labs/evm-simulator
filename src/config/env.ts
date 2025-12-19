import 'dotenv/config';

export interface SimulatorConfig {
  port: number;
  host: string;
  fork: {
    basePort: number;
    startupTimeoutMs: number;
    refreshIntervalMs: number; // 0 = disabled
  };
  logLevel: string;
  nodeEnv: string;
}

export const config: SimulatorConfig = {
  port: parseInt(process.env.PORT || '9000', 10),
  host: process.env.HOST || '0.0.0.0',
  fork: {
    basePort: parseInt(process.env.FORK_BASE_PORT || '9545', 10),
    startupTimeoutMs: parseInt(process.env.FORK_STARTUP_TIMEOUT_MS || '30000', 10),
    refreshIntervalMs: parseInt(process.env.FORK_REFRESH_INTERVAL_MS || '60000', 10), // Default: 60s
  },
  logLevel: process.env.LOG_LEVEL || 'info',
  nodeEnv: process.env.NODE_ENV || 'development',
};
