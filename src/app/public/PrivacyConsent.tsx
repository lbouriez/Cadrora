import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import {
  PRIVACY_PREFERENCES_EVENT,
  readPrivacyConsent,
  savePrivacyConsent,
} from './consent';
import type { PrivacyConsent as PrivacyConsentValue } from './consent';
import { siteProfile } from './siteProfile';

export function PrivacyConsent() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(() => readPrivacyConsent() === null);
  const analyticsAvailable = Boolean(siteProfile.analyticsMeasurementId);

  useEffect(() => {
    const handlePreferences = (event: Event) => {
      if (event instanceof CustomEvent && event.detail === 'open') setOpen(true);
    };
    window.addEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences);
    return () => window.removeEventListener(PRIVACY_PREFERENCES_EVENT, handlePreferences);
  }, []);

  const choose = (value: PrivacyConsentValue) => {
    savePrivacyConsent(value);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <aside aria-labelledby="privacy-consent-title" className="privacy-consent" role="region">
      <div>
        <p className="privacy-consent__eyebrow">{t('gallery.consent.eyebrow')}</p>
        <h2 id="privacy-consent-title">{t('gallery.consent.title')}</h2>
        <p>{t(analyticsAvailable ? 'gallery.consent.body' : 'gallery.consent.bodyNoAnalytics')}</p>
        <Link to="/privacy">{t('gallery.consent.learnMore')}</Link>
      </div>
      <div className="privacy-consent__actions">
        <button className="button button--secondary" onClick={() => choose('necessary')} type="button">
          {t('gallery.consent.necessary')}
        </button>
        {analyticsAvailable ? (
          <button className="button button--primary" onClick={() => choose('analytics')} type="button">
            {t('gallery.consent.analytics')}
          </button>
        ) : null}
      </div>
    </aside>
  );
}
