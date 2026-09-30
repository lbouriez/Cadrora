import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';

import type { SiteSettings } from '../../shared/schemas/site';
import { getPublicServices } from './api';
import { fallbackServices } from './serviceCatalog';

/** Resolve the owner's catalog before mounting images from the compiled fallback. */
export function usePublicServiceCatalog(settings: Pick<UseQueryResult<SiteSettings>, 'data' | 'isPending'>) {
  const services = useQuery({ queryFn: getPublicServices, queryKey: ['public-services'], retry: false, staleTime: 60_000 });
  // A failed catalog read still needs the settings result to apply fallback visibility.
  const isPending = services.isPending || (services.data === undefined && settings.isPending);
  return {
    cards: services.data ?? (isPending ? [] : fallbackServices(settings.data?.enabledServices)),
    isPending,
  };
}
