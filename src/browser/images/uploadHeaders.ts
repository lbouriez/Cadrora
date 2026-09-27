import type { EncodedVariant } from './types';

/** The same verified-image contract is used by gallery and marketing uploads. */
export function variantUploadHeaders<Name extends string>(variant: EncodedVariant<Name>): Record<string, string> {
  return {
    'Content-Type': variant.contentType,
    'X-Cadrora-Byte-Size': String(variant.byteSize),
    'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
    'X-Cadrora-Height': String(variant.height),
    'X-Cadrora-Width': String(variant.width),
  };
}
