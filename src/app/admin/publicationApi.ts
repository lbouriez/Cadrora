import { PublicationSummarySchema } from '../../shared/schemas';
import type { PublicationState, PublicationSummary } from '../../shared/schemas';

export async function getPublicationSummary(eventId: string): Promise<PublicationSummary> {
  const response = await fetch(`/api/v1/admin/events/${encodeURIComponent(eventId)}/publication`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Publication summary returned ${response.status}`);
  return PublicationSummarySchema.parse(await response.json());
}

export async function updatePublication(eventId: string, state: PublicationState): Promise<PublicationSummary> {
  const response = await fetch(`/api/v1/admin/events/${encodeURIComponent(eventId)}/publication`, {
    body: JSON.stringify({ state }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  if (!response.ok) throw new Error(`Publication update returned ${response.status}`);
  return PublicationSummarySchema.parse(await response.json());
}
