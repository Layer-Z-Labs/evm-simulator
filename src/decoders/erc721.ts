/** ERC-721 function selectors */
export const ERC721_SELECTORS = {
  transferFrom: '0x23b872dd',
  safeTransferFrom: '0x42842e0e', // safeTransferFrom(address,address,uint256)
  safeTransferFromWithData: '0xb88d4fde', // safeTransferFrom(address,address,uint256,bytes)
} as const;

export interface DecodedERC721Transfer {
  from: string;
  to: string;
  tokenId: bigint;
}

function decodeAddress(paddedHex: string): string {
  return '0x' + paddedHex.slice(-40).toLowerCase();
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0'.repeat(64)) return 0n;
  const trimmed = hex.replace(/^0+/, '') || '0';
  return BigInt('0x' + trimmed);
}

export function decodeERC721TransferFrom(data: string): DecodedERC721Transfer | null {
  const selector = data.slice(0, 10).toLowerCase();
  // transferFrom and safeTransferFrom have same initial params
  if (selector !== ERC721_SELECTORS.transferFrom &&
      selector !== ERC721_SELECTORS.safeTransferFrom &&
      selector !== ERC721_SELECTORS.safeTransferFromWithData) {
    return null;
  }

  if (data.length < 202) return null; // Minimum for 3 params

  try {
    const params = data.slice(10);
    return {
      from: decodeAddress(params.slice(0, 64)),
      to: decodeAddress(params.slice(64, 128)),
      tokenId: decodeUint256(params.slice(128, 192)),
    };
  } catch {
    return null;
  }
}
