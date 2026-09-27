// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import { PublishPanel } from '../../../src/app/admin/PublishPanel';
import { i18n } from '../../../src/app/i18n';
import type { PublicationSummary } from '../../../src/shared/schemas';

beforeAll(async () => { await i18n.changeLanguage('fr'); });
afterEach(cleanup);

describe('direct gallery link in the admin publication panel', () => {
  it.each(['draft', 'published', 'unlisted', 'offline'] as const)('shows a copyable URL while %s', (state) => {
    const summary: PublicationSummary = {
      eventId: 'gallery-1', totalPhotos: 1, readyPhotos: 1, publishedPhotos: state === 'draft' ? 0 : 1,
      indexingPhotos: 0, publishedAt: state === 'draft' ? null : '2026-09-27T00:00:00.000Z',
      visibility: state === 'offline' ? 'published' : state,
      offlineAt: state === 'offline' ? '2026-09-27T01:00:00.000Z' : null,
    };
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter>
      <PublishPanel eventId="gallery-1" slug="soiree-privee" summary={summary} />
    </MemoryRouter></QueryClientProvider>);

    expect(screen.getByRole('textbox', { name: 'Lien direct de la galerie' }).getAttribute('value'))
      .toBe(`${window.location.origin}/e/soiree-privee`);
    expect(screen.getByRole('button', { name: 'Copier le lien' })).toBeTruthy();
  });
});
