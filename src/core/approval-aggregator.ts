import type {
  ApprovalChanges,
  ApprovalsByAddress,
  AggregatedApproval,
} from '../types/asset-delta.js';
import type { ParsedApprovals } from './log-parser.js';

/**
 * Aggregate approvals into per-address format.
 * For ERC-20: groups by owner -> token -> { spender, amount, isUnlimited }
 * Note: If multiple approvals for same token, last one wins (as on-chain)
 */
export function aggregateApprovals(parsed: ParsedApprovals): {
  approvals: ApprovalChanges;
  approvalsByAddress: ApprovalsByAddress;
} {
  const approvals: ApprovalChanges = {
    erc20: parsed.erc20,
    erc721: parsed.erc721,
    operatorApprovals: parsed.operatorApprovals,
  };

  const approvalsByAddress: ApprovalsByAddress = {};

  // Aggregate ERC-20 approvals by owner
  for (const approval of parsed.erc20) {
    const owner = approval.owner.toLowerCase();
    const token = approval.token.toLowerCase();

    if (!approvalsByAddress[owner]) {
      approvalsByAddress[owner] = {};
    }

    // Last approval for a token wins (matches on-chain behavior)
    approvalsByAddress[owner][token] = {
      spender: approval.spender,
      amount: approval.amount,
      isUnlimited: approval.isUnlimited,
    };
  }

  // Note: ERC-721 and OperatorApprovals are included in the raw approvals
  // but not aggregated into approvalsByAddress since they have different
  // semantics (per-tokenId or boolean operator approval)

  return {
    approvals,
    approvalsByAddress,
  };
}
