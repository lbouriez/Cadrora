// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { PrivacyConsent } from '../../../src/app/public/PrivacyConsent';
import { installPublicResources } from '../../../src/app/public/i18n';
import { openPrivacyPreferences, readPrivacyConsent } from '../../../src/app/public/consent';

beforeAll(() => installPublicResources(i18n));
afterEach(cleanup);

beforeEach(async () => {
  localStorage.clear();
  await i18n.changeLanguage('fr');
});

describe('public privacy consent', () => {
  it('defaults to necessary-only and remembers that choice', () => {
    render(<MemoryRouter><PrivacyConsent /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Votre vie privée, votre choix.' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Nécessaire seulement' }));
    expect(readPrivacyConsent()).toBe('necessary');
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('can be reopened from the persistent privacy control', () => {
    localStorage.setItem('cadrora-privacy-consent-v1', 'necessary');
    render(<MemoryRouter><PrivacyConsent /></MemoryRouter>);
    expect(screen.queryByRole('region')).toBeNull();
    act(() => openPrivacyPreferences());
    expect(screen.getByRole('region', { name: 'Votre vie privée, votre choix.' })).toBeTruthy();
  });

  it('offers optional analytics only when a runtime measurement ID is configured', () => {
    render(<MemoryRouter><PrivacyConsent analyticsAvailable /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: "Autoriser l'analyse" }));
    expect(readPrivacyConsent()).toBe('analytics');
  });
});
