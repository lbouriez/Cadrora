const BYTES_PER_KB = 1_000;
const BYTES_PER_MB = 1_000_000;
const BYTES_PER_GB = 1_000_000_000;

export type MediaStorageUnit = 'bytes' | 'kilobytes' | 'megabytes' | 'gigabytes';

/** Decimal units match the R2 quota; usage keeps a useful unit below 1 GB. */
export function formatMediaStorage(bytes: number, locale: string): { amount: string; unit: MediaStorageUnit } {
  const [divisor, unit]: [number, MediaStorageUnit] = bytes >= BYTES_PER_GB
    ? [BYTES_PER_GB, 'gigabytes']
    : bytes >= BYTES_PER_MB
      ? [BYTES_PER_MB, 'megabytes']
      : bytes >= BYTES_PER_KB
        ? [BYTES_PER_KB, 'kilobytes']
        : [1, 'bytes'];
  return {
    amount: new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 'bytes' ? 0 : 1 }).format(bytes / divisor),
    unit,
  };
}
