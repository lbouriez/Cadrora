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
  build: { sourcemap: true },
  resolve: {
    alias: {
      '@site-definition': resolve('sites', siteId, 'site.ts'),
      '@site-theme': resolve('sites', siteId, 'theme.css'),
    },
  },
  define: {
    __CADRORA_SHOWCASE_DEMO__: JSON.stringify(showcaseDemo),
    __CADRORA_SITE_ID__: JSON.stringify(siteId),
    __CADRORA_SITE_DEFAULT_LANG__: JSON.stringify(site.defaultLanguage ?? 'fr'),
  },
  plugins: [
    react(),
    {
      name: 'cadrora-site-document',
      transformIndexHtml: { order: 'pre', handler(html: string) {
        const icon = site.document.icon;
        const iconType = icon?.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
        const documentHtml = html
          .replace(/<title>[^<]*<\/title>/u, `<title>${site.name}</title>`)
          .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/u, `$1${site.document.description}$2`)
          .replace(/(<meta name="theme-color" content=")[^"]*(" \/>)/u, `$1${site.document.themeColor}$2`)
          .replace(/\s*<link rel="(?:icon|apple-touch-icon)"[^>]*\/>/gu, '')
          .replace('  </head>', `${icon ? `    <link rel="icon" href="${icon}" type="${iconType}" />\n${iconType === 'image/png' ? `    <link rel="apple-touch-icon" href="${icon}" />\n` : ''}` : ''}  </head>`);
        return { html: documentHtml, tags: (site.document.fonts ?? []).map((href: string) => ({
          tag: 'link', attrs: { rel: 'preload', href, as: 'font', type: 'font/woff2', crossorigin: '' }, injectTo: 'head' as const,
        })) };
      } },
    },
    cloudflare(),
  ],
  server: {
    cors: false,
  },
});
