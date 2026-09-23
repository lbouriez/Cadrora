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
    expect(screen.getByText(/map is supplied by OpenStreetMap/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Display the map' }));
    const mapUrl = document.querySelector('iframe')?.getAttribute('src');
    expect(mapUrl).toContain('https://www.openstreetmap.org/export/embed.html?');
    expect(mapUrl).toContain('marker=45.5019%2C-73.5674');
    expect(mapUrl).toContain('bbox=');
    expect(screen.getByRole('link', { name: /OpenStreetMap contributors/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Open the service area in Google Maps/ })).toBeTruthy();
  });
});
