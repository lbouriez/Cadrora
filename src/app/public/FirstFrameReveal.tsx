import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { SiteStartup } from './SiteStartup';

/** Reveal a complete public first frame after its owner data and display photo are ready. */
export function FirstFrameReveal({ children, failed = false, ready }: { children?: ReactNode; failed?: boolean; ready: boolean }) {
  const [startupMounted, setStartupMounted] = useState(true);
  useEffect(() => {
    if (!ready) return;
    // transitionend normally removes the overlay; this also covers reduced motion
    // and a tab hidden while the transition is running.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    const delay = reducedMotion ? 0 : 1000;
    const timeout = window.setTimeout(() => setStartupMounted(false), delay);
    return () => window.clearTimeout(timeout);
  }, [ready]);

  return <>
    {!ready || startupMounted ? <SiteStartup failed={failed} leaving={ready} onFadeComplete={() => setStartupMounted(false)} /> : null}
    {children ? <div aria-hidden={!ready || undefined} className={`session-home__stage${ready ? '' : ' session-home__stage--pending'}`} inert={!ready}>
      {children}
    </div> : null}
  </>;
}
