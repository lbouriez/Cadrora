import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { PRIVACY_PREFERENCES_EVENT, readPrivacyConsent } from './consent';
import { siteProfile } from './siteProfile';

const ANALYTICS_ROUTES = new Set(['/', '/contact', '/galleries', '/privacy', '/services']);

type Gtag = (...values: unknown[]) => void;
type AnalyticsWindow = Window & {
  dataLayer?: unknown[][];
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
  target[`ga-disable-${measurementId}`] = false;
  target.dataLayer ??= [];
  target.gtag ??= (...values: unknown[]) => { target.dataLayer?.push(values); };
  target.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'granted',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
  });
  if (!document.querySelector('script[data-cadrora-analytics]')) {
    const script = document.createElement('script');
    script.async = true;
    script.dataset.cadroraAnalytics = 'true';
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

export function GoogleAnalytics({ measurementId = siteProfile.analyticsMeasurementId }: { measurementId?: string | null }) {
  const location = useLocation();

  useEffect(() => {
    if (!validMeasurementId(measurementId)) return;
    const applyConsent = () => {
      if (readPrivacyConsent() === 'analytics' && ANALYTICS_ROUTES.has(location.pathname)) loadAnalytics(measurementId);
      else disableAnalytics(measurementId);
    };
    applyConsent();
    window.addEventListener(PRIVACY_PREFERENCES_EVENT, applyConsent);
    return () => {
      window.removeEventListener(PRIVACY_PREFERENCES_EVENT, applyConsent);
      disableAnalytics(measurementId);
    };
  }, [location.pathname, measurementId]);

  useEffect(() => {
    if (
      !validMeasurementId(measurementId)
      || readPrivacyConsent() !== 'analytics'
      || !ANALYTICS_ROUTES.has(location.pathname)
    ) return;
    loadAnalytics(measurementId);
    analyticsWindow().gtag?.('event', 'page_view', {
      page_location: `${window.location.origin}${location.pathname}`,
      page_path: location.pathname,
      page_title: document.title,
    });
  }, [location.pathname, measurementId]);

  return null;
}
