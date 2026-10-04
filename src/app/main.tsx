import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { I18nextProvider } from 'react-i18next';
import { BrowserRouter } from 'react-router-dom';

import { App } from './App';
import { ToastProvider } from './components';
import { siteProfile } from './public/siteProfile';
import { i18n } from './i18n';
import { MarketingSnapshotSchema } from '../shared/schemas/marketingSnapshot';
import { MarketingRenderContext } from './prerender/context';
import { createPublicQueryClient } from './prerender/queryClient';
import './styles/base.css';
import '@site-theme';

document.documentElement.dataset.site = siteProfile.id;

const snapshotElement = __CADRORA_MARKETING_PRERENDER__ ? document.getElementById('cadrora-marketing-snapshot') : null;
const snapshot = snapshotElement ? MarketingSnapshotSchema.parse(JSON.parse(snapshotElement.textContent ?? 'null') as unknown) : undefined;
if (snapshot && snapshot.pathname !== window.location.pathname) throw new Error('Mismatched marketing document');
if (snapshot) void i18n.changeLanguage(snapshot.language);
const queryClient = createPublicQueryClient(snapshot);

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

const application = (
  <StrictMode>
    <MarketingRenderContext.Provider value={Boolean(snapshot)}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ToastProvider>
              <App />
            </ToastProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </I18nextProvider>
    </MarketingRenderContext.Provider>
  </StrictMode>
);
if (snapshot) hydrateRoot(root, application);
else createRoot(root).render(application);
