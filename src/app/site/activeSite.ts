import selectedSite from '@site-definition';
import type { SiteDefinition } from './types';

export const activeSite: SiteDefinition = selectedSite;
if (activeSite.id !== __CADRORA_SITE_ID__) throw new Error(`Mismatched site profile: ${__CADRORA_SITE_ID__}`);
