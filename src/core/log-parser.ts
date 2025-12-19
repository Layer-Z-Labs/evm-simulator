import type { TraceLog } from './tracer.js';
import type {
  ERC20Transfer,
  ERC721Transfer,
  ERC1155Transfer,
  ERC20Approval,
  ERC721Approval,
  OperatorApproval,
  ApprovalChanges,
} from '../types/asset-delta.js';
import { createComponentLogger } from '../infrastructure/logging/logger.js';

const logger = createComponentLogger('log-parser');

// Max uint256 for unlimited approval detection
const MAX_UINT256 = 2n ** 256n - 1n;
const MAX_UINT256_STR = MAX_UINT256.toString();

// Event topic signatures
export const EVENT_TOPICS = {
  // ERC-20 and ERC-721 share this topic: Transfer(address,address,uint256)
  TRANSFER: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  // ERC-1155: TransferSingle(address,address,address,uint256,uint256)
  TRANSFER_SINGLE: '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62',
  // ERC-1155: TransferBatch(address,address,address,uint256[],uint256[])
  TRANSFER_BATCH: '0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb',
  // ERC-20 and ERC-721 share this topic: Approval(address,address,uint256)
  APPROVAL: '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925',
  // ERC-721 and ERC-1155: ApprovalForAll(address,address,bool)
  APPROVAL_FOR_ALL: '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31',
} as const;

function decodeAddress(topic: string): string {
  return '0x' + topic.slice(-40).toLowerCase();
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0x') return 0n;
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (!clean || clean === '0'.repeat(64)) return 0n;
  const trimmed = clean.replace(/^0+/, '') || '0';
  return BigInt('0x' + trimmed);
}

export interface ParsedTransfers {
  erc20: ERC20Transfer[];
  erc721: ERC721Transfer[];
  erc1155: ERC1155Transfer[];
}

export function parseTransferLogs(logs: TraceLog[]): ParsedTransfers {
  const result: ParsedTransfers = {
    erc20: [],
    erc721: [],
    erc1155: [],
  };

  for (const log of logs) {
    if (!log.topics || log.topics.length === 0) continue;

    const topic0 = log.topics[0].toLowerCase();

    if (topic0 === EVENT_TOPICS.TRANSFER) {
      parseTransferEvent(log, result);
    } else if (topic0 === EVENT_TOPICS.TRANSFER_SINGLE) {
      parseTransferSingleEvent(log, result);
    } else if (topic0 === EVENT_TOPICS.TRANSFER_BATCH) {
      parseTransferBatchEvent(log, result);
    }
  }

  return result;
}

function parseTransferEvent(log: TraceLog, result: ParsedTransfers): void {
  // ERC-20 Transfer: 3 topics (topic0, from, to) + amount in data
  // ERC-721 Transfer: 4 topics (topic0, from, to, tokenId)

  if (log.topics.length === 4) {
    // ERC-721
    try {
      result.erc721.push({
        token: log.address.toLowerCase(),
        from: decodeAddress(log.topics[1]),
        to: decodeAddress(log.topics[2]),
        tokenId: decodeUint256(log.topics[3]).toString(),
      });
    } catch (err) {
      logger.warn({ log, error: err }, 'Failed to parse ERC-721 Transfer');
    }
  } else if (log.topics.length === 3) {
    // ERC-20
    try {
      result.erc20.push({
        token: log.address.toLowerCase(),
        from: decodeAddress(log.topics[1]),
        to: decodeAddress(log.topics[2]),
        amount: decodeUint256(log.data).toString(),
      });
    } catch (err) {
      logger.warn({ log, error: err }, 'Failed to parse ERC-20 Transfer');
    }
  } else {
    // Default to ERC-20 if ambiguous (TMP focuses on fungibles)
    logger.debug({ log }, 'Ambiguous Transfer event, treating as ERC-20');
    try {
      if (log.topics.length >= 3) {
        result.erc20.push({
          token: log.address.toLowerCase(),
          from: decodeAddress(log.topics[1]),
          to: decodeAddress(log.topics[2]),
          amount: decodeUint256(log.data).toString(),
        });
      }
    } catch (err) {
      logger.warn({ log, error: err }, 'Failed to parse ambiguous Transfer');
    }
  }
}

function parseTransferSingleEvent(log: TraceLog, result: ParsedTransfers): void {
  // TransferSingle(operator, from, to, id, amount)
  // topics: [topic0, operator, from, to]
  // data: [id, amount]
  if (log.topics.length !== 4) return;

  try {
    const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;
    const id = decodeUint256('0x' + data.slice(0, 64));
    const amount = decodeUint256('0x' + data.slice(64, 128));

    result.erc1155.push({
      token: log.address.toLowerCase(),
      operator: decodeAddress(log.topics[1]),
      from: decodeAddress(log.topics[2]),
      to: decodeAddress(log.topics[3]),
      id: id.toString(),
      amount: amount.toString(),
    });
  } catch (err) {
    logger.warn({ log, error: err }, 'Failed to parse ERC-1155 TransferSingle');
  }
}

function parseTransferBatchEvent(log: TraceLog, result: ParsedTransfers): void {
  // TransferBatch(operator, from, to, ids[], amounts[])
  // This is complex due to dynamic arrays - simplified handling
  if (log.topics.length !== 4) return;

  try {
    const operator = decodeAddress(log.topics[1]);
    const from = decodeAddress(log.topics[2]);
    const to = decodeAddress(log.topics[3]);

    // Parse dynamic arrays from data
    const data = log.data.startsWith('0x') ? log.data.slice(2) : log.data;

    // First 64 chars: offset to ids array
    // Second 64 chars: offset to amounts array
    const idsOffset = parseInt(data.slice(0, 64), 16) * 2;
    const amountsOffset = parseInt(data.slice(64, 128), 16) * 2;

    // Parse ids array
    const idsLength = parseInt(data.slice(idsOffset, idsOffset + 64), 16);
    const ids: bigint[] = [];
    for (let i = 0; i < idsLength; i++) {
      const start = idsOffset + 64 + (i * 64);
      ids.push(decodeUint256('0x' + data.slice(start, start + 64)));
    }

    // Parse amounts array
    const amountsLength = parseInt(data.slice(amountsOffset, amountsOffset + 64), 16);
    const amounts: bigint[] = [];
    for (let i = 0; i < amountsLength; i++) {
      const start = amountsOffset + 64 + (i * 64);
      amounts.push(decodeUint256('0x' + data.slice(start, start + 64)));
    }

    // Create individual transfers for each id/amount pair
    for (let i = 0; i < Math.min(ids.length, amounts.length); i++) {
      result.erc1155.push({
        token: log.address.toLowerCase(),
        operator,
        from,
        to,
        id: ids[i].toString(),
        amount: amounts[i].toString(),
      });
    }
  } catch (err) {
    logger.warn({ log, error: err }, 'Failed to parse ERC-1155 TransferBatch');
  }
}

// ============ Approval Parsing ============

export interface ParsedApprovals {
  erc20: ERC20Approval[];
  erc721: ERC721Approval[];
  operatorApprovals: OperatorApproval[];
}

export function parseApprovalLogs(logs: TraceLog[]): ParsedApprovals {
  const result: ParsedApprovals = {
    erc20: [],
    erc721: [],
    operatorApprovals: [],
  };

  for (const log of logs) {
    if (!log.topics || log.topics.length === 0) continue;

    const topic0 = log.topics[0].toLowerCase();

    if (topic0 === EVENT_TOPICS.APPROVAL) {
      parseApprovalEvent(log, result);
    } else if (topic0 === EVENT_TOPICS.APPROVAL_FOR_ALL) {
      parseApprovalForAllEvent(log, result);
    }
  }

  return result;
}

function parseApprovalEvent(log: TraceLog, result: ParsedApprovals): void {
  // ERC-20 Approval: 3 topics (topic0, owner, spender) + amount in data
  // ERC-721 Approval: 4 topics (topic0, owner, spender, tokenId)

  if (log.topics.length === 4) {
    // ERC-721 Approval
    try {
      result.erc721.push({
        token: log.address.toLowerCase(),
        owner: decodeAddress(log.topics[1]),
        spender: decodeAddress(log.topics[2]),
        tokenId: decodeUint256(log.topics[3]).toString(),
      });
    } catch (err) {
      logger.warn({ log, error: err }, 'Failed to parse ERC-721 Approval');
    }
  } else if (log.topics.length === 3) {
    // ERC-20 Approval
    try {
      const amount = decodeUint256(log.data);
      const amountStr = amount.toString();
      const isUnlimited = amount === MAX_UINT256 || amountStr === MAX_UINT256_STR;

      result.erc20.push({
        token: log.address.toLowerCase(),
        owner: decodeAddress(log.topics[1]),
        spender: decodeAddress(log.topics[2]),
        amount: amountStr,
        isUnlimited,
      });
    } catch (err) {
      logger.warn({ log, error: err }, 'Failed to parse ERC-20 Approval');
    }
  }
}

function parseApprovalForAllEvent(log: TraceLog, result: ParsedApprovals): void {
  // ApprovalForAll(address indexed owner, address indexed operator, bool approved)
  // 3 topics: topic0, owner, operator
  // data: bool approved (32 bytes, 0 or 1)

  if (log.topics.length !== 3) return;

  try {
    const approvedValue = decodeUint256(log.data);
    const approved = approvedValue !== 0n;

    result.operatorApprovals.push({
      token: log.address.toLowerCase(),
      owner: decodeAddress(log.topics[1]),
      operator: decodeAddress(log.topics[2]),
      approved,
    });
  } catch (err) {
    logger.warn({ log, error: err }, 'Failed to parse ApprovalForAll');
  }
}
