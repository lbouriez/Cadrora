import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: {
    '@site-definition': resolve('sites', 'cadrora', 'site.ts'),
    'cloudflare:workers': resolve('tests', 'stubs', 'cloudflareWorkers.ts'),
  } },
  define: {
    __CADRORA_SHOWCASE_DEMO__: false,
    __CADRORA_SITE_ID__: JSON.stringify('cadrora'),
    __CADRORA_SITE_DEFAULT_LANG__: JSON.stringify('fr'),
    __CADRORA_SITE_NAME__: JSON.stringify('Cadrora'),
    __CADRORA_SITE_DESCRIPTION__: JSON.stringify('Cadrora, photographie d’événements et galeries privées élégantes.'),
  },
  test: {
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
