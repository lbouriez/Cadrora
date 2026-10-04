import { createContext, useSyncExternalStore } from 'react';

/** Stays enabled after hydration so first-frame photos keep their native srcset. */
export const MarketingRenderContext = createContext(false);

const subscribe = () => () => undefined;
const clientSnapshot = () => false;
const serverSnapshot = () => true;

/** React also uses the server value for the first hydration render. */
export function useServerRender() {
  return useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
}
