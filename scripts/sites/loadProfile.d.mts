export interface SiteManifest {
  id: string;
  name: string;
  document: { description: string; themeColor: string; icon: string | null };
  defaultLanguage?: 'fr' | 'en';
  allowShowcase?: boolean;
  deployment?: { instance: string; hostname: string; initialSettingsSql?: string };
}

export function loadSiteProfile(siteId: string, workspace?: string): SiteManifest;
export function listSiteProfiles(workspace?: string): SiteManifest[];
