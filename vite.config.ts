import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  define: {
    __CADRORA_SHOWCASE_DEMO__: JSON.stringify(process.env.CADRORA_SEED_DEMO?.trim().toLowerCase() === 'true'),
  },
  plugins: [react(), cloudflare()],
  server: {
    cors: false,
  },
});
