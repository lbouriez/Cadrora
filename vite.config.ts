import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { loadSiteProfile } from './scripts/sites/loadProfile.mjs';

const siteId = process.env.CADRORA_SITE?.trim() || 'cadrora';
const site = loadSiteProfile(siteId);
const showcaseDemo = process.env.CADRORA_SEED_DEMO?.trim().toLowerCase() === 'true';
if (showcaseDemo && site.allowShowcase !== true) throw new Error('This site profile does not allow the showcase demo.');

export default defineConfig({
  resolve: {
    alias: {
      '@site-definition': resolve('sites', siteId, 'site.ts'),
      '@site-theme': resolve('sites', siteId, 'theme.css'),
    },
  },
  define: {
    __CADRORA_SHOWCASE_DEMO__: JSON.stringify(showcaseDemo),
    __CADRORA_SITE_ID__: JSON.stringify(siteId),
  },
  plugins: [
    react(),
    {
      name: 'cadrora-site-document',
      transformIndexHtml(html: string) {
        const icon = site.document.icon;
        return html
          .replace(/<title>[^<]*<\/title>/u, `<title>${site.name}</title>`)
          .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/u, `$1${site.document.description}$2`)
          .replace(/(<meta name="theme-color" content=")[^"]*(" \/>)/u, `$1${site.document.themeColor}$2`)
          .replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*\/>/gu, '')
          .replace('  </head>', `${icon ? `    <link rel="icon" href="${icon}" type="image/png" />\n    <link rel="apple-touch-icon" href="${icon}" />\n` : ''}  </head>`);
      },
    },
    cloudflare(),
  ],
  server: {
    cors: false,
  },
});
