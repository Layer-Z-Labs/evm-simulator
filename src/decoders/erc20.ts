/** ERC-20 function selectors */
export const ERC20_SELECTORS = {
  transfer: '0xa9059cbb',
  approve: '0x095ea7b3',
  transferFrom: '0x23b872dd',
} as const;

export interface DecodedTransfer {
  to: string;
  amount: bigint;
}

export interface DecodedApprove {
  spender: string;
  amount: bigint;
}

export interface DecodedTransferFrom {
  from: string;
  to: string;
  amount: bigint;
}

function extractSelector(data: string): string {
  if (!data || data.length < 10) return '';
  return data.slice(0, 10).toLowerCase();
}

function decodeAddress(paddedHex: string): string {
  return '0x' + paddedHex.slice(-40).toLowerCase();
}

function decodeUint256(hex: string): bigint {
  if (!hex || hex === '0'.repeat(64)) return 0n;
  const trimmed = hex.replace(/^0+/, '') || '0';
  return BigInt('0x' + trimmed);
}

export function isERC20Call(data: string): boolean {
  if (!data || data.length < 10) return false;
  const selector = extractSelector(data);
  return Object.values(ERC20_SELECTORS).includes(selector as any);
}

export function decodeTransfer(data: string): DecodedTransfer | null {
  if (extractSelector(data) !== ERC20_SELECTORS.transfer) return null;
  if (data.length !== 138) return null;
  try {
    const params = data.slice(10);
    return {
      to: decodeAddress(params.slice(0, 64)),
      amount: decodeUint256(params.slice(64, 128)),
    };
  } catch {
    return null;
  }
}

export function decodeApprove(data: string): DecodedApprove | null {
  if (extractSelector(data) !== ERC20_SELECTORS.approve) return null;
  if (data.length !== 138) return null;
  try {
    const params = data.slice(10);
    return {
      spender: decodeAddress(params.slice(0, 64)),
      amount: decodeUint256(params.slice(64, 128)),
    };
  } catch {
    return null;
  }
}

export function decodeTransferFrom(data: string): DecodedTransferFrom | null {
  if (extractSelector(data) !== ERC20_SELECTORS.transferFrom) return null;
  if (data.length !== 202) return null;
  try {
    const params = data.slice(10);
    return {
      from: decodeAddress(params.slice(0, 64)),
      to: decodeAddress(params.slice(64, 128)),
      amount: decodeUint256(params.slice(128, 192)),
    };
  } catch {
    return null;
  }
}
