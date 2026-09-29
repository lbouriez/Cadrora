import { AdminSiteSettingsSchema } from '../../shared/schemas';

export async function getAdminSiteSettings() {
  const response = await fetch('/api/v1/admin/site', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Site settings returned ${response.status}`);
  return AdminSiteSettingsSchema.parse(await response.json());
}
