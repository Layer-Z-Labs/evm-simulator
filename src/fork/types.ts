import type { PublicClient } from 'viem';
import type { ChildProcess } from 'child_process';

export type ForkStatus = 'idle' | 'starting' | 'running' | 'error';

export interface ManagedFork {
  networkId: string;
  port: number;
  process: ChildProcess;
  client: PublicClient;
  status: ForkStatus;
  blockNumber: bigint;
  lastActivity: Date;
  error?: string;
}

export interface ForkHealth {
  status: ForkStatus;
  port?: number;
  blockNumber?: string;
  error?: string;
}
