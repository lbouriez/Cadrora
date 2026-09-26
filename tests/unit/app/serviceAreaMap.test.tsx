// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { ServiceAreaMap } from '../../../src/app/public/ServiceAreaMap';

beforeAll(() => installPublicResources(i18n));
afterEach(cleanup);

describe('contact service-area map', () => {
  it('never embeds Google before a visitor click', async () => {
    await i18n.changeLanguage('en');
    render(<ServiceAreaMap centerLatitude={45.5019} centerLongitude={-73.5674} embedKey="restricted-test-key" radiusKm={125} />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByText(/125 km/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Display the map' }));

    expect(document.querySelector('iframe')?.getAttribute('src')).toContain('center=45.5019%2C-73.5674');
  });

  it('uses OpenStreetMap without a key, only after a visitor click', async () => {
    await i18n.changeLanguage('en');
    render(<ServiceAreaMap centerLatitude={45.5019} centerLongitude={-73.5674} embedKey={null} radiusKm={125} />);
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.queryByText(/map is supplied by OpenStreetMap/)).toBeNull();
    expect(document.querySelector('.service-area-map__preview-image .progressive-photo__preview')?.getAttribute('src')).toBe('/brand/responsive/service-area-preview-320.webp');
    expect(screen.queryByRole('link', { name: /OpenStreetMap contributors/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Display the map' }).closest('.service-area-map__preview')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Display the map' }));
    expect(document.querySelector('.service-area-map__preview')).toBeNull();
    const mapUrl = document.querySelector('iframe')?.getAttribute('src');
    expect(mapUrl).toContain('https://www.openstreetmap.org/export/embed.html?');
    expect(mapUrl).toContain('marker=45.5019%2C-73.5674');
    expect(mapUrl).toContain('bbox=');
    expect(mapUrl).toContain('layer=shortbread');
    expect(screen.getByRole('link', { name: /OpenStreetMap contributors/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open the service area in Google Maps/ })).toBeTruthy();
  });

  it('uses the owner-configured radius instead of a fixed showcase value', async () => {
    await i18n.changeLanguage('fr');
    render(<ServiceAreaMap centerLatitude={45.5019} centerLongitude={-73.5674} embedKey={null} radiusKm={180} />);
    expect(screen.getByText(/180 km/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Afficher la carte' })).toBeTruthy();
  });

  it('frames a 50 km radius with 10% margin around the selected centre', async () => {
    await i18n.changeLanguage('en');
    render(<ServiceAreaMap centerLatitude={45.5930624} centerLongitude={-73.3395943} embedKey={null} radiusKm={50} />);
    fireEvent.click(screen.getByRole('button', { name: 'Display the map' }));
    const url = new URL(document.querySelector('iframe')?.getAttribute('src') ?? '');
    const bounds = url.searchParams.get('bbox')?.split(',').map(Number) ?? [];
    expect(bounds).toHaveLength(4);
    expect((bounds[3]! - 45.5930624) * 111.32).toBeCloseTo(55, 1);
    expect((45.5930624 - bounds[1]!) * 111.32).toBeCloseTo(55, 1);
    expect((bounds[0]! + bounds[2]!) / 2).toBeCloseTo(-73.3395943, 5);
  });
});
