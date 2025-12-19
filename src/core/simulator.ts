import type { PublicClient } from 'viem';
import { createComponentLogger } from '../infrastructure/logging/logger.js';
import { traceCall, extractNativeTransfers } from './tracer.js';
import { parseTransferLogs, parseApprovalLogs } from './log-parser.js';
import { aggregateDeltas } from './delta-aggregator.js';
import { aggregateApprovals } from './approval-aggregator.js';
import type { TransactionParams, SimulateResponse } from '../types/simulation.js';
import { createEmptyAssetChanges, createEmptyApprovals, createErrorResponse } from '../types/simulation.js';
import type { AssetChanges } from '../types/asset-delta.js';

const logger = createComponentLogger('simulator');

export interface SimulatorDeps {
  getClient: (networkId: string) => Promise<PublicClient>;
}

export class Simulator {
  constructor(private deps: SimulatorDeps) {}

  async simulate(networkId: string, tx: TransactionParams): Promise<SimulateResponse> {
    logger.info({ networkId, from: tx.from, to: tx.to }, 'Starting simulation');

    try {
      // Get the fork client
      const client = await this.deps.getClient(networkId);

      // Execute trace
      const traceResult = await traceCall(client, tx);

      if (!traceResult.success) {
        logger.info({ networkId, revertReason: traceResult.revertReason }, 'Transaction reverted');
        return createErrorResponse(traceResult.revertReason || 'Transaction reverted');
      }

      // Extract native transfers from call tree
      const nativeTransfers = extractNativeTransfers(traceResult.callTrace);

      // Parse event logs for token transfers
      const tokenTransfers = parseTransferLogs(traceResult.logs);

      // Parse event logs for approvals
      const parsedApprovals = parseApprovalLogs(traceResult.logs);

      // Build asset changes
      const assetChanges: AssetChanges = {
        native: nativeTransfers.map(t => ({
          from: t.from,
          to: t.to,
          amount: t.value.toString(),
        })),
        erc20: tokenTransfers.erc20,
        erc721: tokenTransfers.erc721,
        erc1155: tokenTransfers.erc1155,
      };

      // Aggregate deltas
      const { involvedAddresses, deltasByAddress } = aggregateDeltas(assetChanges);

      // Aggregate approvals
      const { approvals, approvalsByAddress } = aggregateApprovals(parsedApprovals);

      logger.info({
        networkId,
        gasUsed: traceResult.gasUsed?.toString(),
        nativeCount: assetChanges.native.length,
        erc20Count: assetChanges.erc20.length,
        erc721Count: assetChanges.erc721.length,
        erc1155Count: assetChanges.erc1155.length,
        approvalCount: approvals.erc20.length + approvals.erc721.length + approvals.operatorApprovals.length,
        involvedCount: involvedAddresses.length,
      }, 'Simulation completed');

      return {
        success: true,
        revertReason: null,
        gasUsed: traceResult.gasUsed?.toString() || null,
        involvedAddresses,
        assetChanges,
        deltasByAddress,
        approvals,
        approvalsByAddress,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error({ networkId, error: message }, 'Simulation failed');
      return createErrorResponse(message);
    }
  }
}
