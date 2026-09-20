import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface TurnstileRenderOptions {
  appearance: 'interaction-only';
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
  execution: 'execute';
  language: 'auto';
  sitekey: string;
  theme: 'auto';
}

interface TurnstileApi {
  execute(widgetId: string): void;
  remove(widgetId: string): void;
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  reset(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export interface TurnstileChallengeHandle {
  requestToken: () => Promise<string>;
}

const SCRIPT_ID = 'cadrora-turnstile-script';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const ready = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('TURNSTILE_UNAVAILABLE'));
    };
    const failed = () => reject(new Error('TURNSTILE_UNAVAILABLE'));
    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener('load', ready, { once: true });
      existing.addEventListener('error', failed, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.id = SCRIPT_ID;
    script.src = SCRIPT_URL;
    script.addEventListener('load', ready, { once: true });
    script.addEventListener('error', failed, { once: true });
    document.head.append(script);
  }).catch((error: unknown) => {
    scriptPromise = undefined;
    throw error;
  });
  return scriptPromise;
}

/** Explicit, execute-on-submit Turnstile widget for SPA forms. */
export const TurnstileChallenge = forwardRef<TurnstileChallengeHandle>(function TurnstileChallenge(_, forwardedRef) {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<TurnstileApi | undefined>(undefined);
  const widgetIdRef = useRef<string | undefined>(undefined);
  const pendingRef = useRef<{ reject: (reason: Error) => void; resolve: (token: string) => void } | undefined>(undefined);
  const [status, setStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();

  useImperativeHandle(forwardedRef, () => ({
    requestToken: () => {
      const api = apiRef.current;
      const widgetId = widgetIdRef.current;
      if (!api || !widgetId || status !== 'ready') return Promise.reject(new Error('TURNSTILE_UNAVAILABLE'));
      pendingRef.current?.reject(new Error('TURNSTILE_REPLACED'));
      return new Promise<string>((resolve, reject) => {
        pendingRef.current = { reject, resolve };
        api.reset(widgetId);
        api.execute(widgetId);
      });
    },
  }), [status]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !siteKey) {
      setStatus('unavailable');
      return;
    }
    let active = true;
    void loadTurnstile().then((api) => {
      if (!active) return;
      apiRef.current = api;
      widgetIdRef.current = api.render(container, {
        appearance: 'interaction-only',
        callback: (token) => {
          const pending = pendingRef.current;
          pendingRef.current = undefined;
          pending?.resolve(token);
        },
        'error-callback': () => {
          const pending = pendingRef.current;
          pendingRef.current = undefined;
          pending?.reject(new Error('TURNSTILE_FAILED'));
        },
        'expired-callback': () => {
          const pending = pendingRef.current;
          pendingRef.current = undefined;
          pending?.reject(new Error('TURNSTILE_EXPIRED'));
        },
        execution: 'execute',
        language: 'auto',
        sitekey: siteKey,
        theme: 'auto',
      });
      setStatus('ready');
    }).catch(() => {
      if (active) setStatus('unavailable');
    });

    return () => {
      active = false;
      pendingRef.current?.reject(new Error('TURNSTILE_UNMOUNTED'));
      pendingRef.current = undefined;
      if (apiRef.current && widgetIdRef.current) apiRef.current.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, [siteKey]);

  return (
    <div className="turnstile-challenge">
      <div ref={containerRef} />
      {status === 'loading' ? <p role="status">{t('security.challengeLoading')}</p> : null}
      {status === 'unavailable' ? <p role="alert">{t('security.challengeUnavailable')}</p> : null}
    </div>
  );
});
