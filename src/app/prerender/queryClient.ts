import { QueryClient } from '@tanstack/react-query';
import type { MarketingSnapshot } from '../../shared/schemas/marketingSnapshot';

export function createPublicQueryClient(snapshot?: MarketingSnapshot) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000 } } });
  if (snapshot) {
    client.setQueryData(['public-site-settings'], snapshot.settings);
    client.setQueryData(['public-services'], snapshot.services);
  }
  return client;
}
