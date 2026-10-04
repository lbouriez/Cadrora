import { cloudflare } from '@cloudflare/vite-plugin';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { loadSiteProfile } from './scripts/sites/loadProfile.mjs';

const siteId = process.env.CADRORA_SITE?.trim() || 'cadrora';
const site = loadSiteProfile(siteId);
const showcaseDemo = process.env.CADRORA_SEED_DEMO?.trim().toLowerCase() === 'true';
if (showcaseDemo && site.allowShowcase !== true) throw new Error('This site profile does not allow the showcase demo.');

export default defineConfig(({ command, isPreview }) => {
  const marketingPrerender = process.env.CADRORA_MARKETING_PRERENDER === 'true';
  if (marketingPrerender && (siteId !== 'cadrora' || (command === 'build' && process.env.CLOUDFLARE_ENV !== 'preview'))) {
    throw new Error('Marketing prerender is an isolated Cadrora preview experiment (CLOUDFLARE_ENV=preview).');
  }
  return ({
    build: { sourcemap: true },
    resolve: {
      alias: {
        '@site-definition': resolve('sites', siteId, 'site.ts'),
        '@site-theme': resolve('sites', siteId, 'theme.css'),
      },
    },
    define: {
      __CADRORA_MARKETING_PRERENDER__: JSON.stringify(marketingPrerender),
      __CADRORA_SHOWCASE_DEMO__: JSON.stringify(showcaseDemo),
      __CADRORA_SITE_ID__: JSON.stringify(siteId),
      __CADRORA_SITE_DEFAULT_LANG__: JSON.stringify(site.defaultLanguage ?? 'fr'),
    },
    plugins: [
      react(),
      {
        name: 'cadrora-preview-marketing-renderer',
        resolveId(id: string) { if (id === 'virtual:cadrora-marketing-renderer') return '\0cadrora-marketing-renderer'; },
        load(id: string) {
          if (id === '\0cadrora-marketing-renderer') return `export { renderMarketing } from ${JSON.stringify(resolve('src/app/prerender/render.tsx').replaceAll('\\', '/'))};`;
        },
      },
      {
        name: 'cadrora-site-document',
        transformIndexHtml: { order: 'pre', handler(html: string) {
          const icon = site.document.icon;
          const iconType = icon?.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
          const documentHtml = html
            .replace('/src/app/main.tsx', marketingPrerender ? '/src/app/prerender/entry.ts' : '/src/app/main.tsx')
            .replace('<html lang="fr">', `<html lang="${site.defaultLanguage ?? 'fr'}" data-site="${siteId}">`)
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
      cloudflare({
        // Localized documents and 404 files are generated only after a build.
        config: { assets: {
          ...(command === 'serve' && !isPreview ? { not_found_handling: 'single-page-application' as const } : {}),
          ...(marketingPrerender ? { run_worker_first: ['/', '/fr', '/fr/', '/en', '/en/'] } : {}),
        } },
      }),
    ],
    server: {
      cors: false,
    },
  });
});
