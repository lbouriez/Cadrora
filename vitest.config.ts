import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __CADRORA_SHOWCASE_DEMO__: false,
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
