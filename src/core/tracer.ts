import type { PublicClient, Hex } from 'viem';
import { createComponentLogger } from '../infrastructure/logging/logger.js';
import type { TransactionParams } from '../types/simulation.js';

const logger = createComponentLogger('tracer');

export interface CallTrace {
  type: string;
  from: string;
  to?: string;
  value?: string;
  gas?: string;
  gasUsed?: string;
  input?: string;
  output?: string;
  error?: string;
  revertReason?: string;
  calls?: CallTrace[];
  logs?: TraceLog[];
}

export interface TraceLog {
  address: string;
  topics: string[];
  data: string;
}

export interface TraceResult {
  success: boolean;
  gasUsed: bigint | null;
  revertReason: string | null;
  callTrace: CallTrace | null;
  logs: TraceLog[];
}

// Error selectors for revert reason decoding
const ERROR_SELECTOR = '0x08c379a0'; // Error(string)
const PANIC_SELECTOR = '0x4e487b71'; // Panic(uint256)

function decodeRevertReason(output: string): string {
  if (!output || output === '0x') return 'Transaction reverted';

  const selector = output.slice(0, 10).toLowerCase();

  if (selector === ERROR_SELECTOR) {
    try {
      // Skip selector (4 bytes) + offset (32 bytes) + length (32 bytes) = 68 bytes = 136 chars + 2 for 0x
      const hex = output.slice(138);
      const bytes = Buffer.from(hex, 'hex');
      return bytes.toString('utf8').replace(/\0/g, '');
    } catch {
      return output;
    }
  }

  if (selector === PANIC_SELECTOR) {
    try {
      const code = BigInt('0x' + output.slice(10));
      const panicCodes: Record<string, string> = {
        '0': 'Generic panic',
        '1': 'Assert failed',
        '17': 'Arithmetic overflow/underflow',
        '18': 'Division by zero',
        '33': 'Invalid enum value',
        '34': 'Invalid storage access',
        '49': 'Pop on empty array',
        '50': 'Out of bounds array access',
        '65': 'Out of memory',
        '81': 'Call to uninitialized function',
      };
      return panicCodes[code.toString()] || `Panic(${code})`;
    } catch {
      return output;
    }
  }

  return output;
}

function extractLogsFromCallTree(callTrace: CallTrace): TraceLog[] {
  const logs: TraceLog[] = [];

  if (callTrace.logs) {
    logs.push(...callTrace.logs);
  }

  if (callTrace.calls) {
    for (const subcall of callTrace.calls) {
      logs.push(...extractLogsFromCallTree(subcall));
    }
  }

  return logs;
}

export async function traceCall(
  client: PublicClient,
  tx: TransactionParams
): Promise<TraceResult> {
  try {
    // Try debug_traceCall first
    const result = await client.request({
      method: 'debug_traceCall' as any,
      params: [
        {
          from: tx.from as Hex,
          to: tx.to as Hex | undefined,
          data: tx.data as Hex | undefined,
          value: tx.value,
          gas: tx.gas,
        },
        'latest',
        { tracer: 'callTracer', tracerConfig: { withLog: true } } as any,
      ] as any,
    }) as CallTrace;

    const logs = extractLogsFromCallTree(result);
    const hasError = !!result.error || !!result.revertReason;

    return {
      success: !hasError,
      gasUsed: result.gasUsed ? BigInt(result.gasUsed) : null,
      revertReason: hasError ? decodeRevertReason(result.output || result.revertReason || '') : null,
      callTrace: result,
      logs,
    };
  } catch (err) {
    // Fallback to eth_call for basic success/revert check
    logger.warn({ error: err }, 'debug_traceCall failed, falling back to eth_call');

    try {
      await client.call({
        account: tx.from as Hex,
        to: tx.to as Hex,
        data: tx.data as Hex,
        value: tx.value ? BigInt(tx.value) : undefined,
      });

      return {
        success: true,
        gasUsed: null,
        revertReason: null,
        callTrace: null,
        logs: [],
      };
    } catch (callErr: any) {
      return {
        success: false,
        gasUsed: null,
        revertReason: callErr.message || 'Transaction reverted',
        callTrace: null,
        logs: [],
      };
    }
  }
}

export function extractNativeTransfers(callTrace: CallTrace | null): Array<{ from: string; to: string; value: bigint }> {
  if (!callTrace) return [];

  const transfers: Array<{ from: string; to: string; value: bigint }> = [];

  function walk(trace: CallTrace) {
    if (trace.value && trace.to) {
      const value = BigInt(trace.value);
      if (value > 0n) {
        transfers.push({
          from: trace.from.toLowerCase(),
          to: trace.to.toLowerCase(),
          value,
        });
      }
    }

    if (trace.calls) {
      for (const subcall of trace.calls) {
        walk(subcall);
      }
    }
  }

  walk(callTrace);
  return transfers;
}
