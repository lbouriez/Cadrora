// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { i18n } from '../../../src/app/i18n';
import { installPublicResources } from '../../../src/app/public/i18n';
import { SessionDetailsModal } from '../../../src/app/public/SessionDetailsModal';
import { ServiceCardSchema, ServiceCopyLanguageSchema } from '../../../src/shared/schemas';
import type { ServiceCopy } from '../../../src/shared/schemas';

beforeAll(() => installPublicResources(i18n));
afterEach(async () => { cleanup(); await i18n.changeLanguage('fr'); });

const legacy = { title: 'Session', shortDescription: 'Short', description: 'Session description', points: [], priceRange: '$250–$650 CAD' };
const tariffs = [
  { name: 'Mini', price: '$250 CAD', summary: 'One hour and 40 photos.' },
  { name: 'Signature', price: '$450 CAD', summary: 'Two hours and 100 photos.' },
];

function show(copy: ServiceCopy['en']) {
  const card = ServiceCardSchema.parse({ id: 'family', isBuiltin: true, sortOrder: 0, enabled: true,
    showOnHome: true, imageRevision: null, imageSources: [], copy: { fr: copy, en: copy } });
  render(<MemoryRouter><SessionDetailsModal card={card} onClose={() => {}} /></MemoryRouter>);
}

describe('session pricing', () => {
  it('keeps legacy copy valid, validates tariffs and limits practical information', () => {
    expect(ServiceCopyLanguageSchema.parse(legacy)).toEqual(legacy);
    expect(ServiceCopyLanguageSchema.safeParse({ ...legacy, tariffs, goodToKnow: 'x'.repeat(1000) }).success).toBe(true);
    for (const value of [
      { ...legacy, tariffs: Array.from({ length: 9 }, () => tariffs[0]) },
      { ...legacy, tariffs: [{ ...tariffs[0], price: ' ' }] },
      { ...legacy, tariffs: [{ ...tariffs[0], summary: 'x'.repeat(601) }] },
      { ...legacy, tariffs: [{ ...tariffs[0], unsupported: true }] },
      { ...legacy, goodToKnow: 'x'.repeat(1001) },
    ]) expect(ServiceCopyLanguageSchema.safeParse(value).success).toBe(false);
  });

  for (const language of ['fr', 'en'] as const) {
    it(`${language}: keeps the traditional display and omits empty optional sections`, async () => {
      await i18n.changeLanguage(language);
      show({ ...legacy, tariffs: [], goodToKnow: ' \n ' });
      expect(screen.getByText('$250–$650 CAD', { exact: false })).toBeTruthy();
      expect(screen.queryByRole('list')).toBeNull();
      expect(screen.queryByRole('region', { name: language === 'fr' ? 'Bon à savoir' : 'Good to know' })).toBeNull();
    });
    it(`${language}: renders one tariff simply without a stale multi-price overview`, async () => {
      await i18n.changeLanguage(language);
      show({ ...legacy, tariffs: tariffs.slice(0, 1) });
      expect(screen.getByText('Mini — $250 CAD', { exact: false })).toBeTruthy();
      expect(screen.getByText('One hour and 40 photos.')).toBeTruthy();
      expect(screen.queryByText('$250–$650 CAD', { exact: false })).toBeNull();
      expect(screen.queryByRole('list')).toBeNull();
    });
    it(`${language}: shows an overview, package bullets, and practical information after inclusions`, async () => {
      await i18n.changeLanguage(language);
      show({ ...legacy, tariffs, points: ['Private gallery'], goodToKnow: '50% deposit.\nTravel included.' });
      const packages = screen.getByRole('region', { name: language === 'fr' ? 'Forfaits' : 'Packages' });
      expect(within(packages).getAllByRole('listitem')).toHaveLength(2);
      expect(screen.getByText('$250–$650 CAD', { exact: false })).toBeTruthy();
      const practical = screen.getByRole('region', { name: language === 'fr' ? 'Bon à savoir' : 'Good to know' });
      expect(practical.textContent).toContain('50% deposit.');
      expect(screen.getByText('Private gallery').compareDocumentPosition(practical) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
  }
});
