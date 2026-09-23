import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { siteProfile } from './siteProfile';

export interface ServiceAreaMapProps {
  centerLatitude: number;
  centerLongitude: number;
  embedKey?: string | null;
  radiusKm: number;
}

function approximateZoom(radiusKm: number): number {
  return Math.max(4, Math.min(14, Math.round(12 - Math.log2(radiusKm / 10))));
}

/** Consent-by-click Google Maps view; the radius is labelled, not represented as a precise drawn boundary. */
export function ServiceAreaMap({ centerLatitude, centerLongitude, embedKey = siteProfile.mapsEmbedKey, radiusKm }: ServiceAreaMapProps) {
  const { t } = useTranslation();
  const [showMap, setShowMap] = useState(false);
  const zoom = approximateZoom(radiusKm);
  const center = `${centerLatitude},${centerLongitude}`;
  const mapUrl = embedKey
    ? `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(embedKey)}&center=${encodeURIComponent(center)}&zoom=${zoom}`
    : null;
  const externalUrl = `https://www.google.com/maps/@${centerLatitude},${centerLongitude},${zoom}z`;

  return (
    <section aria-labelledby="service-area-map-title" className="service-area-map">
      <div className="service-area-map__copy">
        <p className="site-eyebrow">{t('gallery.contactServiceArea')}</p>
        <h2 id="service-area-map-title">{t('gallery.contactMapTitle')}</h2>
        <p>{t('gallery.contactMapRadius', { radius: radiusKm })}</p>
        <p className="service-area-map__privacy">{t('gallery.contactMapPrivacy')}</p>
        {mapUrl ? <button className="button button--secondary" onClick={() => setShowMap(true)} type="button">{t('gallery.contactMapLoad')}</button> : (
          <p className="service-area-map__privacy">{t('gallery.contactMapUnavailable')}</p>
        )}
        <a className="button button--secondary" href={externalUrl} rel="noreferrer" target="_blank">{t('gallery.contactMapOpen')} <span aria-hidden="true">↗</span></a>
      </div>
      <div className="service-area-map__visual">
        {showMap && mapUrl ? <iframe
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={mapUrl}
          title={t('gallery.contactMapTitle')}
        /> : <div aria-hidden="true" className="service-area-map__placeholder"><span /></div>}
      </div>
    </section>
  );
}
