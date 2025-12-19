/**
 * JSON replacer function that converts BigInt values to strings
 */
export const bigIntReplacer = (key: string, value: any): any => {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
};

/**
 * Recursively convert any BigInt values in an object to strings for safe JSON serialization
 */
export function makeBigIntSafe<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString() as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => makeBigIntSafe(item)) as unknown as T;
  }

  if (typeof value === 'object' && value.constructor === Object) {
    const safe: any = {};
    for (const [key, val] of Object.entries(value)) {
      safe[key] = makeBigIntSafe(val);
    }
    return safe as T;
  }

  return value;
}
