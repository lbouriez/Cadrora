const featureFlagBindings = {
  publicMediaCache: 'FEATURE_PUBLIC_MEDIA_CACHE',
} as const satisfies Record<string, keyof CloudflareBindings>;

export type FeatureFlag = keyof typeof featureFlagBindings;

/** Missing and malformed flags are disabled. */
export function featureEnabled(bindings: CloudflareBindings | undefined, flag: FeatureFlag): boolean {
  return bindings?.[featureFlagBindings[flag]] === 'true';
}
