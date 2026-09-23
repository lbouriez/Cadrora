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

function openStreetMapUrl(latitude: number, longitude: number, radiusKm: number): string {
  // The bounding box frames the approximate travel area; it does not draw a service boundary.
  const latitudeSpan = radiusKm / 111.32;
  const longitudeSpan = radiusKm / (111.32 * Math.max(0.01, Math.abs(Math.cos(latitude * Math.PI / 180))));
  const bounds = [
    Math.max(-85, latitude - latitudeSpan),
    Math.max(-180, longitude - longitudeSpan),
    Math.min(85, latitude + latitudeSpan),
    Math.min(180, longitude + longitudeSpan),
  ];
  const bbox = `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** Consent-by-click map; the radius is labelled, not represented as a precise drawn boundary. */
export function ServiceAreaMap({ centerLatitude, centerLongitude, embedKey = siteProfile.mapsEmbedKey, radiusKm }: ServiceAreaMapProps) {
  const { t } = useTranslation();
  const [showMap, setShowMap] = useState(false);
  const zoom = approximateZoom(radiusKm);
  const center = `${centerLatitude},${centerLongitude}`;
  const mapUrl = embedKey
    ? `https://www.google.com/maps/embed/v1/view?key=${encodeURIComponent(embedKey)}&center=${encodeURIComponent(center)}&zoom=${zoom}`
    : openStreetMapUrl(centerLatitude, centerLongitude, radiusKm);
  const externalUrl = `https://www.google.com/maps/@${centerLatitude},${centerLongitude},${zoom}z`;

  return (
    <section aria-labelledby="service-area-map-title" className="service-area-map">
      <div className="service-area-map__copy">
        <p className="site-eyebrow">{t('gallery.contactServiceArea')}</p>
        <h2 id="service-area-map-title">{t('gallery.contactMapTitle')}</h2>
        <p>{t('gallery.contactMapRadius', { radius: radiusKm })}</p>
        <a className="button button--secondary" href={externalUrl} rel="noreferrer" target="_blank">{t('gallery.contactMapOpen')} <span aria-hidden="true">↗</span></a>
        {showMap && !embedKey ? <a className="service-area-map__attribution" href="https://www.openstreetmap.org/copyright" rel="noreferrer" target="_blank">© OpenStreetMap contributors</a> : null}
      </div>
      <div className="service-area-map__visual">
        {showMap ? <iframe
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          src={mapUrl}
          title={t('gallery.contactMapTitle')}
        /> : <div className="service-area-map__preview">
          <img alt="" className="service-area-map__preview-image" loading="lazy" src="/brand/service-area-preview.webp" />
          <div className="service-area-map__preview-content">
            <p>{t('gallery.contactMapPreview')}</p>
            <button className="button button--primary" onClick={() => setShowMap(true)} type="button">{t('gallery.contactMapLoad')} <span aria-hidden="true">→</span></button>
          </div>
        </div>}
      </div>
    </section>
  );
}
