import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { BrandPhoto } from './BrandPhoto';
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
  // Frame the approximate travel radius with 10% breathing room; this is not a drawn boundary.
  const viewRadiusKm = radiusKm * 1.1;
  const latitudeSpan = viewRadiusKm / 111.32;
  const longitudeSpan = viewRadiusKm / (111.32 * Math.max(0.01, Math.abs(Math.cos(latitude * Math.PI / 180))));
  const bounds = [
    Math.max(-85, latitude - latitudeSpan),
    Math.max(-180, longitude - longitudeSpan),
    Math.min(85, latitude + latitudeSpan),
    Math.min(180, longitude + longitudeSpan),
  ];
  const bbox = `${bounds[1]},${bounds[0]},${bounds[3]},${bounds[2]}`;
  // OSM's vector layer permits fractional zoom when fitting the bounds.
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=shortbread&marker=${encodeURIComponent(`${latitude},${longitude}`)}`;
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
        <p className="site-eyebrow">{t('gallery.contactMapEyebrow')}</p>
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
          <BrandPhoto alt="" className="service-area-map__preview-image" sizes="(max-width: 48rem) 100vw, 50vw" src={siteProfile.mapPreviewUrl} />
          <div className="service-area-map__preview-content">
            <p>{t('gallery.contactMapPreview')}</p>
            <button className="button button--primary" onClick={() => setShowMap(true)} type="button">{t('gallery.contactMapLoad')} <span aria-hidden="true">→</span></button>
          </div>
        </div>}
      </div>
    </section>
  );
}
