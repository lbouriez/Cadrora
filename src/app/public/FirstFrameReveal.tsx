import type { ReactNode } from 'react';

import { SiteStartup } from './SiteStartup';

/** Reveal a complete public first frame after its owner data and display photo are ready. */
export function FirstFrameReveal({ children, failed = false, ready }: { children?: ReactNode; failed?: boolean; ready: boolean }) {
  return <>
    {!ready ? <SiteStartup failed={failed} /> : null}
    {children ? <div aria-hidden={!ready || undefined} className={`session-home__stage${ready ? '' : ' session-home__stage--pending'}`} inert={!ready}>
      {children}
    </div> : null}
  </>;
}
