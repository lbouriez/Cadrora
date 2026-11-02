// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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
  window.history.replaceState({}, '', '/');
});

function renderAnalytics(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <GoogleAnalytics measurementId={measurementId} />
    </MemoryRouter>,
  );
}

describe('consented Google Analytics loader', () => {
  it('records only an enumerated intent after consent, without link text or destination', () => {
    const view = render(<MemoryRouter><GoogleAnalytics measurementId={measurementId} />
      <button data-marketing-action="demo_search" data-private-url="/e/private?token=sensitive"><span>Visitor content</span></button>
      <button data-marketing-action="untrusted-value">Unknown action</button>
    </MemoryRouter>);
    const events = () => (window as unknown as { dataLayer?: IArguments[] }).dataLayer
      ?.filter(entry => entry[0] === 'event' && entry[1] === 'marketing_action').map(entry => Array.from(entry as ArrayLike<unknown>)) ?? [];
    fireEvent.click(view.getByText('Visitor content'));
    expect(events()).toEqual([]);
    act(() => savePrivacyConsent('analytics'));
    fireEvent.click(view.getByText('Visitor content'));
    fireEvent.click(view.getByText('Unknown action'));
    expect(events()).toEqual([['event', 'marketing_action', { action: 'demo_search' }]]);
    window.history.replaceState({}, '', '/e/private/find');
    fireEvent.click(view.getByText('Visitor content'));
    expect(events()).toHaveLength(1);
    window.history.replaceState({}, '', '/');
    act(() => savePrivacyConsent('necessary'));
    fireEvent.click(view.getByText('Visitor content'));
    expect(events()).toHaveLength(1);
  });

  it('does not create an analytics queue without an owner-configured measurement ID', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    const view = render(<MemoryRouter><GoogleAnalytics measurementId={null} />
      <button data-marketing-action="setup_guide">Guide</button>
    </MemoryRouter>);
    fireEvent.click(view.getByText('Guide'));
    expect((window as unknown as { dataLayer?: IArguments[] }).dataLayer).toBeUndefined();
    expect(document.querySelector('script[data-cadrora-analytics]')).toBeNull();
  });

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

  it('includes localized marketing pages without enabling localized gallery routes', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    renderAnalytics('/fr');
    expect(document.querySelector('script[data-cadrora-analytics]')).not.toBeNull();
    expect((window as unknown as { dataLayer?: IArguments[] }).dataLayer?.some((entry) =>
      entry[0] === 'event' && entry[1] === 'page_view'
      && (entry[2] as { page_path?: string }).page_path === '/fr',
    )).toBe(true);

    cleanup();
    document.querySelectorAll('script[data-cadrora-analytics]').forEach((script) => script.remove());
    renderAnalytics('/en/e/private-gallery');
    expect(document.querySelector('script[data-cadrora-analytics]')).toBeNull();
  });

  it('records the current marketing page when consent is granted without navigation', () => {
    renderAnalytics('/contact');
    act(() => savePrivacyConsent('analytics'));

    expect(document.querySelector('script[data-cadrora-analytics]')).not.toBeNull();
    expect((window as unknown as { dataLayer?: IArguments[] }).dataLayer?.some((entry) =>
      Object.prototype.toString.call(entry) === '[object Arguments]'
      && entry[0] === 'event'
      && entry[1] === 'page_view'
      && (entry[2] as { page_path?: string }).page_path === '/contact',
    )).toBe(true);
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

  it('fails closed when the marketing layout unmounts before an admin navigation', async () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'analytics');
    const rendered = renderAnalytics('/');
    expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(false);

    rendered.unmount();

    await waitFor(() => expect((window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`]).toBe(true));
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
