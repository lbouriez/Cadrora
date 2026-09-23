// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';

import { GoogleAnalytics } from '../../../src/app/public/GoogleAnalytics';
import { savePrivacyConsent } from '../../../src/app/public/consent';

const measurementId = 'G-ABCDEF1234';

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.querySelectorAll('script[data-cadrora-analytics]').forEach((script) => script.remove());
  const target = window as unknown as Record<string, unknown>;
  delete target.dataLayer;
  delete target.gtag;
  delete target[`ga-disable-${measurementId}`];
});

function renderAnalytics(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GoogleAnalytics measurementId={measurementId} />
    </MemoryRouter>,
  );
}

describe('consented Google Analytics loader', () => {
  it('loads no Google resource before explicit consent', () => {
    renderAnalytics();
    expect(document.querySelector('script[data-cadrora-analytics]')).toBeNull();
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
  });

  it('loads after consent only on the marketing route allowlist', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    renderAnalytics('/galleries');
    expect(document.querySelector('script[data-cadrora-analytics]')).not.toBeNull();

    cleanup();
    document.querySelectorAll('script[data-cadrora-analytics]').forEach((script) => script.remove());
    renderAnalytics('/e/lumiere-et-promesses');
    expect(document.querySelector('script[data-cadrora-analytics]')).toBeNull();
  });

  it('records the current marketing page when consent is granted without navigation', () => {
    renderAnalytics('/contact');
    act(() => savePrivacyConsent('analytics'));

    expect(document.querySelector('script[data-cadrora-analytics]')).not.toBeNull();
    expect((window as unknown as { dataLayer?: unknown[][] }).dataLayer).toContainEqual([
      'event', 'page_view', expect.objectContaining({ page_path: '/contact' }),
    ]);
  });

  it('disables collection and clears GA cookies when consent is withdrawn', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    document.cookie = '_ga=GA1.1.test; Path=/';
    renderAnalytics();
    expect(document.cookie).toContain('_ga=');

    act(() => savePrivacyConsent('necessary'));

    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
    expect(document.cookie).not.toContain('_ga=');
  });

  it('fails closed when the marketing layout unmounts before an admin navigation', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    const rendered = renderAnalytics('/');
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(false);

    rendered.unmount();

    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
  });

  it('replaces the Google tag when the owner changes the runtime ID', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    const page = render(<MemoryRouter><GoogleAnalytics measurementId={measurementId} /></MemoryRouter>);
    expect(document.querySelector<HTMLScriptElement>('script[data-cadrora-analytics]')?.dataset.measurementId).toBe(measurementId);

    page.rerender(<MemoryRouter><GoogleAnalytics measurementId="G-NEWID12345" /></MemoryRouter>);

    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true);
    expect(document.querySelector<HTMLScriptElement>('script[data-cadrora-analytics]')?.dataset.measurementId).toBe('G-NEWID12345');
  });
});
