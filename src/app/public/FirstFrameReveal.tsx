import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { SiteStartup } from './SiteStartup';

/** Keep owner sources stable while revealing either the complete frame or its photo canvas. */
export function FirstFrameReveal({ children, failed = false, mediaReveal = false, prepared = false, ready }: {
  children?: ReactNode; failed?: boolean; mediaReveal?: boolean; prepared?: boolean; ready: boolean;
}) {
  const [startupMounted, setStartupMounted] = useState(true);
  const [desktop, setDesktop] = useState(() => typeof window !== 'undefined'
    && (window.matchMedia?.('(min-width: 55rem)').matches ?? false));
  const [photoVisible, setPhotoVisible] = useState(false);
  const visible = ready || (mediaReveal && desktop && prepared);
  useEffect(() => {
    if (!mediaReveal || !window.matchMedia) return;
    const query = window.matchMedia('(min-width: 55rem)');
    const update = () => setDesktop(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, [mediaReveal]);
  useEffect(() => {
    if (!mediaReveal || !ready) return;
    const frame = window.requestAnimationFrame(() => setPhotoVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [mediaReveal, ready]);
  useEffect(() => {
    if (!visible) return;
    // transitionend normally removes the overlay; this also covers reduced motion
    // and a tab hidden while the transition is running.
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? true;
    const delay = reducedMotion ? 0 : mediaReveal && desktop ? 400 : 1000;
    const timeout = window.setTimeout(() => setStartupMounted(false), delay);
    return () => window.clearTimeout(timeout);
  }, [desktop, mediaReveal, visible]);

  return <>
    {!visible || startupMounted ? <SiteStartup failed={failed} leaving={visible} mediaReveal={mediaReveal} onFadeComplete={() => setStartupMounted(false)} /> : null}
    {children ? <div aria-hidden={!visible || undefined} className={`session-home__stage${visible ? '' : ' session-home__stage--pending'}${mediaReveal ? ' session-home__stage--media' : ''}${photoVisible ? ' session-home__stage--media-photo-ready' : ''}`} inert={!visible}>
      {children}
    </div> : null}
  </>;
}
