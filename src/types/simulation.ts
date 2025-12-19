import type { AssetChanges, DeltasByAddress, ApprovalChanges, ApprovalsByAddress } from './asset-delta.js';

export interface TransactionParams {
  from: string;
  to?: string;
  data?: string;
  value?: string;
  gas?: string;
  gasPrice?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

export interface SimulateRequest {
  networkId: string;
  tx: TransactionParams;
}

export interface SimulateResponse {
  success: boolean;
  revertReason: string | null;
  gasUsed: string | null;
  involvedAddresses: string[];
  assetChanges: AssetChanges;
  deltasByAddress: DeltasByAddress;
  approvals: ApprovalChanges;
  approvalsByAddress: ApprovalsByAddress;
}

export function createEmptyAssetChanges(): AssetChanges {
  return {
    native: [],
    erc20: [],
    erc721: [],
    erc1155: [],
  };
}

export function createEmptyApprovals(): ApprovalChanges {
  return {
    erc20: [],
    erc721: [],
    operatorApprovals: [],
  };
}

export function createErrorResponse(reason: string): SimulateResponse {
  return {
    success: false,
    revertReason: reason,
    gasUsed: null,
    involvedAddresses: [],
    assetChanges: createEmptyAssetChanges(),
    deltasByAddress: {},
    approvals: createEmptyApprovals(),
    approvalsByAddress: {},
  };
}
