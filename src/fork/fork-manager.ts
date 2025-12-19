import { spawn, ChildProcess } from 'child_process';
import { createPublicClient, http, PublicClient } from 'viem';
import { createComponentLogger } from '../infrastructure/logging/logger.js';
import { config } from '../config/env.js';
import { getNetwork, type NetworkConfig } from '../config/networks.js';
import type { ManagedFork, ForkStatus, ForkHealth } from './types.js';

const logger = createComponentLogger('fork-manager');

export class ForkManager {
  private forks: Map<string, ManagedFork> = new Map();
  private nextPort: number;

  constructor() {
    this.nextPort = config.fork.basePort;
  }

  async getOrCreateFork(networkId: string): Promise<ManagedFork> {
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

    this.forks.set(network.id, managedFork);

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

  async refreshFork(networkId: string): Promise<void> {
    const existing = this.forks.get(networkId);
    if (existing) {
      this.killProcess(existing.process);
      this.forks.delete(networkId);
    }

    const network = getNetwork(networkId);
    if (!network) {
      throw new Error(`Unknown network: ${networkId}`);
    }

    await this.spawnFork(network);
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
