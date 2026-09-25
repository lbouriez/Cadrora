import type { ServiceKey } from '../../shared/schemas/site';
import { siteProfile } from './siteProfile';

/** Local demo visuals; operators can replace these repository assets for their own studio. */
export const serviceVisuals = [
  { key: 'wedding', src: siteProfile.serviceImages.wedding },
  { key: 'family', src: siteProfile.serviceImages.family },
  { key: 'brand', src: siteProfile.serviceImages.brand },
  { key: 'corporate', src: siteProfile.serviceImages.corporate },
  { key: 'children', src: siteProfile.serviceImages.children },
] as const satisfies readonly { key: ServiceKey; src: string }[];
