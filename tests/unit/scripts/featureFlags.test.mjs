import { describe, expect, it } from 'vitest';

import { featureFlagVars } from '../../../scripts/config/featureFlags.mjs';

describe('deployment feature flags', () => {
  it('uses declared defaults and accepts explicit true or false for any feature', () => {
    const defaults = { FEATURE_PUBLIC_MEDIA_CACHE: 'false', FEATURE_OTHER: 'true', SITE_DEFAULT_LANG: 'fr' };
    expect(featureFlagVars(defaults, {})).toEqual(defaults);
    expect(featureFlagVars(defaults, { FEATURE_PUBLIC_MEDIA_CACHE: ' true ', FEATURE_OTHER: 'FALSE' }))
      .toEqual({ FEATURE_PUBLIC_MEDIA_CACHE: 'true', FEATURE_OTHER: 'false', SITE_DEFAULT_LANG: 'fr' });
  });

  it('rejects a typo rather than silently selecting a deployment mode', () => {
    expect(() => featureFlagVars({ FEATURE_PUBLIC_MEDIA_CACHE: 'false' }, { FEATURE_PUBLIC_MEDIA_CACHE: 'yes' }))
      .toThrow('must be true or false');
  });
});
