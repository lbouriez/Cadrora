import { defineConfig, devices } from '@playwright/test';

const port = 4_178;

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
      testMatch: /public-website\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
    env: {
      ...process.env,
      CADRORA_SEED_DEMO: 'true',
      VITE_APP_NAME: 'Atelier Cadrora',
      VITE_PHOTOGRAPHER_NAME: 'Camille Cadrora',
      VITE_CONTACT_PHONE: '+1 514 555 0142',
      VITE_CONTACT_EMAIL: 'bonjour@example.test',
      VITE_CONTACT_ADDRESS: '123 rue Lumiere, Montreal',
      VITE_SERVICE_AREA: 'Montreal et environs',
      VITE_TURNSTILE_SITE_KEY: 'e2e-site-key',
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: `http://127.0.0.1:${port}`,
  },
});
