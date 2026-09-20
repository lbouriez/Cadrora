import type { EventGrant, Session } from '../shared/schemas';

export interface AuthContext {
  admin?: Session;
  eventGrant?: EventGrant;
}

export type CachePolicy =
  | 'admin'
  | 'asset'
  | 'event-protected'
  | 'event-public'
  | 'media-protected'
  | 'media-public';

export interface AppVariables {
  auth: AuthContext;
  cachePolicy?: CachePolicy;
  requestId: string;
}

export interface AppEnv {
  Bindings: CloudflareBindings;
  Variables: AppVariables;
}
