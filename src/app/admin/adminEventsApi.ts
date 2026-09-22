import { AdminEventListSchema } from '../../shared/schemas';
import type { Event } from '../../shared/schemas';

export async function getAdminEvents(): Promise<Event[]> {
  const response = await fetch('/api/v1/admin/galleries', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Event list returned ${response.status}`);
  return AdminEventListSchema.parse(await response.json()).events;
}
