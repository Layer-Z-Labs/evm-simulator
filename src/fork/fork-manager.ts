import { spawn, ChildProcess } from 'child_process';
import { createPublicClient, http, PublicClient } from 'viem';
import { createComponentLogger } from '../infrastructure/logging/logger.js';
import { config } from '../config/env.js';
import { getNetwork, NETWORKS, type NetworkConfig } from '../config/networks.js';
import type { ManagedFork, ForkStatus, ForkHealth } from './types.js';

const logger = createComponentLogger('fork-manager');

export class ForkManager {
  private forks: Map<string, ManagedFork> = new Map();
  private refreshPromises: Map<string, Promise<ManagedFork>> = new Map();
  private refreshInterval: NodeJS.Timeout | null = null;
  private nextPort: number;

  constructor() {
    this.nextPort = config.fork.basePort;
  }

  /**
   * Start periodic refresh of all active forks.
   * Call this after the server starts.
   */
  startPeriodicRefresh(): void {
    const intervalMs = config.fork.refreshIntervalMs;
    if (intervalMs <= 0) {
      logger.info('Periodic fork refresh disabled');
      return;
    }

    logger.info({ intervalMs }, 'Starting periodic fork refresh');
    this.refreshInterval = setInterval(() => {
      this.refreshAllForks().catch((err) => {
        logger.error({ error: err.message }, 'Error during periodic refresh');
      });
    }, intervalMs);
  }

  /**
   * Stop periodic refresh. Call during shutdown.
   */
  stopPeriodicRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('Stopped periodic fork refresh');
    }
  }

  /**
   * Get or create a fork. If the fork is currently refreshing,
   * waits for the refresh to complete before returning.
   */
  async getOrCreateFork(networkId: string): Promise<ManagedFork> {
    // If a refresh is in progress, wait for it
    const refreshPromise = this.refreshPromises.get(networkId);
    if (refreshPromise) {
      logger.debug({ networkId }, 'Waiting for fork refresh to complete');
      return refreshPromise;
    }

    const existing = this.forks.get(networkId);
    if (existing && existing.status === 'running') {
      existing.lastActivity = new Date();
      return existing;
    }

    const network = getNetwork(networkId);
    if (!network) {
      throw new Error(`Unknown network: ${networkId}`);
    }

    if (!network.upstreamRpc) {
      throw new Error(`No RPC URL configured for network: ${networkId}`);
    }

    return this.spawnFork(network);
  }

  /**
   * Refresh a specific fork. Requests during refresh will wait.
   */
  async refreshFork(networkId: string): Promise<void> {
    // If already refreshing, wait for that to complete
    const existingRefresh = this.refreshPromises.get(networkId);
    if (existingRefresh) {
      await existingRefresh;
      return;
    }

    const network = getNetwork(networkId);
    if (!network) {
      throw new Error(`Unknown network: ${networkId}`);
    }

    const existing = this.forks.get(networkId);
    if (existing) {
      existing.status = 'refreshing';
    }

    // Create a refresh promise that others can wait on
    const refreshPromise = this.doRefresh(network, existing);
    this.refreshPromises.set(networkId, refreshPromise);

    try {
      await refreshPromise;
    } finally {
      this.refreshPromises.delete(networkId);
    }
  }

  /**
   * Refresh all active forks. Called by periodic refresh.
   */
  private async refreshAllForks(): Promise<void> {
    const activeNetworks = Array.from(this.forks.keys());
    if (activeNetworks.length === 0) {
      return;
    }

    logger.info({ networks: activeNetworks }, 'Refreshing all forks');

    // Refresh sequentially to avoid port conflicts
    for (const networkId of activeNetworks) {
      try {
        await this.refreshFork(networkId);
      } catch (err) {
        logger.error(
          { networkId, error: err instanceof Error ? err.message : 'Unknown error' },
          'Failed to refresh fork'
        );
      }
    }
  }

  /**
   * Internal refresh implementation. Spawns new fork before killing old one
   * to minimize downtime.
   */
  private async doRefresh(network: NetworkConfig, existing: ManagedFork | undefined): Promise<ManagedFork> {
    const startTime = Date.now();
    logger.info({ networkId: network.id }, 'Refreshing fork');

    try {
      // Spawn new fork first (on new port)
      const newFork = await this.spawnFork(network);

      // Kill old fork after new one is ready
      if (existing) {
        this.killProcess(existing.process);
      }

      const duration = Date.now() - startTime;
      logger.info({ networkId: network.id, duration, newPort: newFork.port }, 'Fork refresh complete');

      return newFork;
    } catch (err) {
      // If spawn fails and we have an existing fork, try to keep using it
      if (existing && existing.status !== 'error') {
        existing.status = 'running';
        logger.warn({ networkId: network.id }, 'Refresh failed, keeping existing fork');
        return existing;
      }
      throw err;
    }
  }

  private async spawnFork(network: NetworkConfig): Promise<ManagedFork> {
    const port = this.nextPort++;
    logger.info({ networkId: network.id, port }, 'Spawning Anvil fork');

    const anvilProcess = spawn('anvil', [
      '--fork-url', network.upstreamRpc,
      '--port', String(port),
      '--host', '127.0.0.1',
    ], {
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const managedFork: ManagedFork = {
      networkId: network.id,
      port,
      process: anvilProcess,
      client: null as any, // Will be set after health check
      status: 'starting',
      blockNumber: 0n,
      lastActivity: new Date(),
    };

    // Handle process errors
    anvilProcess.on('error', (err) => {
      logger.error({ networkId: network.id, error: err.message }, 'Anvil process error');
      managedFork.status = 'error';
      managedFork.error = err.message;
    });

    anvilProcess.on('exit', (code) => {
      logger.info({ networkId: network.id, code }, 'Anvil process exited');
      if (managedFork.status !== 'error') {
        managedFork.status = 'idle';
      }
    });

    // Wait for fork to be ready
    try {
      await this.waitForFork(managedFork, port);
      managedFork.status = 'running';
      this.forks.set(network.id, managedFork);
      logger.info({ networkId: network.id, port, blockNumber: managedFork.blockNumber.toString() }, 'Fork ready');
      return managedFork;
    } catch (err) {
      managedFork.status = 'error';
      managedFork.error = err instanceof Error ? err.message : 'Unknown error';
      this.killProcess(anvilProcess);
      throw err;
    }
  }

  private async waitForFork(fork: ManagedFork, port: number): Promise<void> {
    const client = createPublicClient({
      transport: http(`http://127.0.0.1:${port}`),
    });

    const startTime = Date.now();
    const timeout = config.fork.startupTimeoutMs;

    while (Date.now() - startTime < timeout) {
      try {
        const blockNumber = await client.getBlockNumber();
        fork.client = client;
        fork.blockNumber = blockNumber;
        return;
      } catch {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    throw new Error(`Fork startup timeout after ${timeout}ms`);
  }

  getForkStatus(networkId: string): ForkHealth {
    const fork = this.forks.get(networkId);
    if (!fork) {
      return { status: 'idle' };
    }
    return {
      status: fork.status,
      port: fork.port,
      blockNumber: fork.blockNumber.toString(),
      error: fork.error,
    };
  }

  getAllForkStatuses(): Record<string, ForkHealth> {
    const statuses: Record<string, ForkHealth> = {};
    for (const [networkId] of this.forks) {
      statuses[networkId] = this.getForkStatus(networkId);
    }
    return statuses;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down all forks');
    this.stopPeriodicRefresh();

    const shutdownPromises: Promise<void>[] = [];

    for (const [networkId, fork] of this.forks) {
      shutdownPromises.push(
        new Promise((resolve) => {
          logger.info({ networkId }, 'Killing fork process');
          fork.process.once('exit', () => resolve());
          this.killProcess(fork.process);
          // Fallback timeout
          setTimeout(() => resolve(), 5000);
        })
      );
    }

    await Promise.all(shutdownPromises);
    this.forks.clear();
    logger.info('All forks shut down');
  }

  private killProcess(proc: ChildProcess): void {
    if (proc.killed) return;
    proc.kill('SIGTERM');
    setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 3000);
  }
}
