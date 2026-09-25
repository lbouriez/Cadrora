import { ApiException } from '../../shared/errors/ApiError';
import { QuotaLimitsSchema, QuotaUsageSchema } from '../../shared/schemas/site';
import type { QuotaLimits, QuotaUsage } from '../../shared/schemas/site';

const R2_FREE_STORAGE_BYTES = 10_000_000_000;
const FACE_VECTOR_DIMENSIONS = 128;
const VECTORIZE_FREE_STORED_DIMENSIONS = 5_000_000;

interface OwnerQuotaRow {
  owner_face_limit: number | null;
  owner_storage_limit_bytes: number | null;
}

interface CountRow {
  value: number;
}

export interface QuotaBindings {
  DB: D1Database;
  MAX_FACES_PER_EVENT: string;
  MAX_STORAGE_BYTES: string;
  MAX_TOTAL_FACES: string;
}

function requiredPositiveLimit(value: string | undefined, name: string): number {
  if (!value || !/^[1-9]\d*$/u.test(value)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, {
      cause: new Error(`${name} is invalid`),
    });
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new ApiException('CONFIGURATION_INVALID', 'errors.configurationInvalid', 503, {
      cause: new Error(`${name} is unsafe`),
    });
  }
  return parsed;
}

export function quotaCeilings(bindings: Omit<QuotaBindings, 'DB'>): QuotaLimits {
  return QuotaLimitsSchema.parse({
    faceLimit: Math.min(
      requiredPositiveLimit(bindings.MAX_TOTAL_FACES, 'MAX_TOTAL_FACES'),
      Math.floor(VECTORIZE_FREE_STORED_DIMENSIONS / FACE_VECTOR_DIMENSIONS),
    ),
    storageLimitBytes: Math.min(
      requiredPositiveLimit(bindings.MAX_STORAGE_BYTES, 'MAX_STORAGE_BYTES'),
      R2_FREE_STORAGE_BYTES,
    ),
  });
}

export async function effectiveQuotaLimits(bindings: QuotaBindings): Promise<QuotaLimits> {
  const ceilings = quotaCeilings(bindings);
  const owner = await bindings.DB.prepare(
    `SELECT owner_storage_limit_bytes, owner_face_limit
       FROM site_settings WHERE id = 1`,
  ).first<OwnerQuotaRow>();
  if (!owner) throw new ApiException('SITE_SETTINGS_NOT_FOUND', 'errors.siteSettingsNotFound', 404);
  return QuotaLimitsSchema.parse({
    faceLimit: Math.min(owner.owner_face_limit ?? ceilings.faceLimit, ceilings.faceLimit),
    storageLimitBytes: Math.min(
      owner.owner_storage_limit_bytes ?? ceilings.storageLimitBytes,
      ceilings.storageLimitBytes,
    ),
  });
}

export async function quotaUsage(database: D1Database): Promise<QuotaUsage> {
  const [storage, faces] = await Promise.all([
    database.prepare('SELECT COALESCE(SUM(byte_size), 0) AS value FROM photo_variants').first<CountRow>(),
    database.prepare('SELECT COUNT(*) AS value FROM faces').first<CountRow>(),
  ]);
  return QuotaUsageSchema.parse({
    faces: faces?.value ?? 0,
    storageBytes: storage?.value ?? 0,
  });
}

export async function siteQuotaSnapshot(bindings: QuotaBindings) {
  const [limits, usage] = await Promise.all([
    effectiveQuotaLimits(bindings),
    quotaUsage(bindings.DB),
  ]);
  return { ceilings: quotaCeilings(bindings), limits, usage };
}
