import { defineConfig, devices } from '@playwright/test';
import { loadSiteProfile } from './scripts/sites/loadProfile.mjs';

const port = 4_178;
const site = loadSiteProfile(process.env.CADRORA_SITE || 'cadrora');
const showcase = site.allowShowcase === true;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1_440, height: 900 } },
    },
    {
      name: 'mobile-chromium',
      testMatch: /(public-website|site-profile)\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: {
      ...process.env,
      CADRORA_SEED_DEMO: showcase ? 'true' : 'false',
      VITE_APP_NAME: showcase ? 'Atelier Cadrora' : site.name,
      VITE_PHOTOGRAPHER_NAME: showcase ? 'Camille Cadrora' : '',
      VITE_CONTACT_PHONE: showcase ? '+1 514 555 0142' : '',
      VITE_CONTACT_EMAIL: showcase ? 'bonjour@example.test' : '',
      VITE_CONTACT_ADDRESS: showcase ? '123 rue Lumiere, Montreal' : '',
      VITE_SERVICE_AREA: showcase ? 'Montreal et environs' : '',
      VITE_TURNSTILE_SITE_KEY: 'e2e-site-key',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});
