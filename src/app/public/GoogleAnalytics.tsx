import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { PRIVACY_PREFERENCES_EVENT, readPrivacyConsent } from './consent';

const ANALYTICS_ROUTES = new Set(['/', '/contact', '/galleries', '/privacy', '/services']);
let pendingDisable: ReturnType<typeof setTimeout> | null = null;

type Gtag = (...values: unknown[]) => void;
type AnalyticsWindow = Window & {
  dataLayer?: IArguments[];
  gtag?: Gtag;
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function validMeasurementId(value: string | null): value is string {
  return typeof value === 'string' && /^G-[A-Z0-9]{6,20}$/u.test(value);
}

function analyticsWindow(): AnalyticsWindow {
  return window as unknown as AnalyticsWindow;
}

function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(';')
    .map((entry) => entry.trim().split('=')[0])
    .filter((name): name is string => Boolean(name && (name === '_ga' || name.startsWith('_ga_'))));
  for (const name of names) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    if (window.location.hostname) {
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${window.location.hostname}; SameSite=Lax`;
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=.${window.location.hostname}; SameSite=Lax`;
    }
  }
}

function disableAnalytics(measurementId: string): void {
  analyticsWindow()[`ga-disable-${measurementId}`] = true;
  analyticsWindow().gtag?.('consent', 'update', { analytics_storage: 'denied' });
  clearAnalyticsCookies();
}

function loadAnalytics(measurementId: string): void {
  const target = analyticsWindow();
  const existing = document.querySelector<HTMLScriptElement>('script[data-cadrora-analytics]');
  if (existing && existing.dataset.measurementId !== measurementId) {
    if (existing.dataset.measurementId) disableAnalytics(existing.dataset.measurementId);
    existing.remove();
    target.dataLayer = [];
    delete target.gtag;
  }
  const loaded = Boolean(document.querySelector('script[data-cadrora-analytics]'));
  target[`ga-disable-${measurementId}`] = false;
  target.dataLayer ??= [];
  // Google's gtag.js command queue expects the Arguments object, not a rest-parameter array.
  // eslint-disable-next-line prefer-rest-params -- gtag.js requires the Arguments object.
  target.gtag ??= function gtag() { target.dataLayer?.push(arguments); };
  target.gtag('consent', loaded ? 'update' : 'default', {
    ad_storage: 'denied',
    analytics_storage: 'granted',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!loaded) {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cadroraAnalytics = 'true';
    script.dataset.measurementId = measurementId;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.append(script);
    target.gtag('js', new Date());
    target.gtag('config', measurementId, {
      allow_ad_personalization_signals: false,
      allow_google_signals: false,
      anonymize_ip: true,
      send_page_view: false,
    });
  }
}

export function GoogleAnalytics({ measurementId }: { measurementId: string | null }) {
  const location = useLocation();

  useEffect(() => {
    if (!validMeasurementId(measurementId)) return;
    const applyConsent = () => {
      if (readPrivacyConsent() === 'analytics' && ANALYTICS_ROUTES.has(location.pathname)) {
        if (pendingDisable !== null) {
          clearTimeout(pendingDisable);
          pendingDisable = null;
        }
        loadAnalytics(measurementId);
        analyticsWindow().gtag?.('event', 'page_view', {
          page_location: `${window.location.origin}${location.pathname}`,
          page_path: location.pathname,
          page_title: document.title,
        });
      } else disableAnalytics(measurementId);
    };
    applyConsent();
    window.addEventListener(PRIVACY_PREFERENCES_EVENT, applyConsent);
    return () => {
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, applyConsent);
      if (!ANALYTICS_ROUTES.has(window.location.pathname)) {
        disableAnalytics(measurementId);
      } else {
        if (pendingDisable !== null) clearTimeout(pendingDisable);
        pendingDisable = setTimeout(() => {
          pendingDisable = null;
          disableAnalytics(measurementId);
        }, 0);
      }
    };
  }, [location.pathname, measurementId]);

  return null;
}
