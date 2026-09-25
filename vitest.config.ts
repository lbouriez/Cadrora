import { configDefaults, defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: { alias: { '@site-definition': resolve('sites', 'cadrora', 'site.ts') } },
  define: {
    __CADRORA_SHOWCASE_DEMO__: false,
    __CADRORA_SITE_ID__: JSON.stringify('cadrora'),
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
