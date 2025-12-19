import type { AssetChanges, DeltasByAddress, AddressDeltas } from '../types/asset-delta.js';

const NATIVE_KEY = 'native';

interface DeltaAccumulator {
  [address: string]: {
    [tokenOrNative: string]: bigint;
  };
}

/**
 * Aggregate asset changes into per-address net deltas
 */
export function aggregateDeltas(assetChanges: AssetChanges): {
  involvedAddresses: string[];
  deltasByAddress: DeltasByAddress;
} {
  const accumulator: DeltaAccumulator = {};
  const addressSet = new Set<string>();

  // Helper to add a delta
  const addDelta = (address: string, key: string, delta: bigint) => {
    const addr = address.toLowerCase();
    addressSet.add(addr);

    if (!accumulator[addr]) {
      accumulator[addr] = {};
    }
    if (!accumulator[addr][key]) {
      accumulator[addr][key] = 0n;
    }
    accumulator[addr][key] += delta;
  };

  // Process native transfers
  for (const transfer of assetChanges.native) {
    const amount = BigInt(transfer.amount);
    addDelta(transfer.from, NATIVE_KEY, -amount);
    addDelta(transfer.to, NATIVE_KEY, amount);
  }

  // Process ERC-20 transfers
  for (const transfer of assetChanges.erc20) {
    const amount = BigInt(transfer.amount);
    const token = transfer.token.toLowerCase();
    addressSet.add(token); // Token contract is involved
    addDelta(transfer.from, token, -amount);
    addDelta(transfer.to, token, amount);
  }

  // Process ERC-721 transfers
  for (const transfer of assetChanges.erc721) {
    const token = transfer.token.toLowerCase();
    const tokenKey = `${token}:${transfer.tokenId}`;
    addressSet.add(token);
    addDelta(transfer.from, tokenKey, -1n);
    addDelta(transfer.to, tokenKey, 1n);
  }

  // Process ERC-1155 transfers
  for (const transfer of assetChanges.erc1155) {
    const amount = BigInt(transfer.amount);
    const token = transfer.token.toLowerCase();
    const tokenKey = `${token}:${transfer.id}`;
    addressSet.add(token);
    addDelta(transfer.from, tokenKey, -amount);
    addDelta(transfer.to, tokenKey, amount);
  }

  // Convert accumulator to signed string format
  const deltasByAddress: DeltasByAddress = {};

  for (const [address, deltas] of Object.entries(accumulator)) {
    const addressDeltas: AddressDeltas = {};

    for (const [key, value] of Object.entries(deltas)) {
      if (value === 0n) continue; // Skip zero deltas

      // Format as signed string: +100 or -50
      const sign = value > 0n ? '+' : '';
      addressDeltas[key] = sign + value.toString();
    }

    // Only include addresses with non-zero deltas
    if (Object.keys(addressDeltas).length > 0) {
      deltasByAddress[address] = addressDeltas;
    }
  }

  return {
    involvedAddresses: Array.from(addressSet).sort(),
    deltasByAddress,
  };
}
