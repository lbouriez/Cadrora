/* eslint-disable react-refresh/only-export-components -- Worker-only rendering entry, not a refresh boundary. */
import { QueryClientProvider } from '@tanstack/react-query';
import { createInstance } from 'i18next';
import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import { StaticRouter, useRoutes } from 'react-router-dom';

import type { MarketingSnapshot } from '../../shared/schemas/marketingSnapshot';
import { ToastProvider } from '../components/Toast';
import { resources } from '../i18n/resources';
import { HomePage } from '../public/HomePage';
import { ServicesPage } from '../public/ShowcasePages';
import { installPublicResources } from '../public/i18n';
import { RouteScrollReset } from '../routes/RouteScrollReset';
import { MarketingRenderContext } from './context';
import { createPublicQueryClient } from './queryClient';

// Keep the same React tree shape as App, without importing admin/gallery bundles
// into the Worker. Only these routes can reach this experimental renderer.
function MarketingApp() {
  const routes = useRoutes([{ path: '/', element: <HomePage /> }, ...(['fr', 'en'] as const).flatMap((language) => [
    { path: `/${language}`, element: <HomePage /> },
    { path: `/${language}/services`, element: <ServicesPage /> },
  ])]);
  return <><RouteScrollReset />{routes}</>;
}

export async function renderMarketing(snapshot: MarketingSnapshot): Promise<string> {
  // An instance per request prevents concurrent FR/EN requests sharing language.
  const i18n = createInstance();
  await i18n.init({ resources, lng: snapshot.language, fallbackLng: 'fr',
    supportedLngs: ['fr', 'en'], interpolation: { escapeValue: false } });
  installPublicResources(i18n);
  const queryClient = createPublicQueryClient(snapshot);
  try {
    return renderToString(
      <StrictMode>
        <MarketingRenderContext.Provider value>
          <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
              <StaticRouter location={snapshot.pathname}>
                <ToastProvider><MarketingApp /></ToastProvider>
              </StaticRouter>
            </QueryClientProvider>
          </I18nextProvider>
        </MarketingRenderContext.Provider>
      </StrictMode>,
    );
  } finally { queryClient.clear(); }
}
