/** ERC-1155 function selectors */
export const ERC1155_SELECTORS = {
  safeTransferFrom: '0xf242432a', // safeTransferFrom(address,address,uint256,uint256,bytes)
  safeBatchTransferFrom: '0x2eb2c2d6', // safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)
} as const;

export interface DecodedERC1155Transfer {
  from: string;
  to: string;
  id: bigint;
  amount: bigint;
}

export interface DecodedERC1155BatchTransfer {
  from: string;
  to: string;
  ids: bigint[];
  amounts: bigint[];
}

function decodeAddress(paddedHex: string): string {
  return '0x' + paddedHex.slice(-40).toLowerCase();
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0'.repeat(64)) return 0n;
  const trimmed = hex.replace(/^0+/, '') || '0';
  return BigInt('0x' + trimmed);
}

export function decodeERC1155SafeTransferFrom(data: string): DecodedERC1155Transfer | null {
  const selector = data.slice(0, 10).toLowerCase();
  if (selector !== ERC1155_SELECTORS.safeTransferFrom) return null;

  if (data.length < 330) return null; // 4 + 32*5 + dynamic bytes

  try {
    const params = data.slice(10);
    return {
      from: decodeAddress(params.slice(0, 64)),
      to: decodeAddress(params.slice(64, 128)),
      id: decodeUint256(params.slice(128, 192)),
      amount: decodeUint256(params.slice(192, 256)),
    };
  } catch {
    return null;
  }
}

// Batch transfer decoding is more complex due to dynamic arrays
// For now, we rely on event logs for batch transfers
