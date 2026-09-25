import { PHOTO_VARIANT_WIDTHS } from '../../shared/constants';

/** Public covers are published with the prepared display variants at one revisioned media path. */
export function coverPhotoSources(coverPhotoUrl: string) {
  if (!/^\/media\/[^/]+\/[^/]+\/\d+\/medium$/u.test(coverPhotoUrl)) {
    return [{ url: coverPhotoUrl, width: PHOTO_VARIANT_WIDTHS.medium }];
  }
  const base = coverPhotoUrl.slice(0, -'medium'.length);
  return (['thumb', 'small', 'medium'] as const).map((variant) => ({
    url: `${base}${variant}`,
    width: PHOTO_VARIANT_WIDTHS[variant],
  }));
}
