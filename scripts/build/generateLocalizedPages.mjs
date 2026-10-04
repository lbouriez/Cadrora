import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { loadSiteProfile } from '../sites/loadProfile.mjs';
import startupCopy from '../../src/shared/i18n/publicStartup.json' with { type: 'json' };

const site = loadSiteProfile(process.env.CADRORA_SITE?.trim() || 'cadrora');
const output = 'dist/client';
const shell = await readFile(join(output, 'index.html'), 'utf8');
const pages = [
  ['home', ''], ['services', 'services'], ['portfolio', 'portfolio'],
  ['about', 'about'], ['contact', 'contact'], ['privacy', 'privacy'],
];

function escapeHtml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function pageUrl(language, path) {
  return `${site.document.origin}/${language}/${path ? `${path}/` : ''}`;
}

function documentFor(language, page, path) {
  const copy = site.document.pages?.[page]?.[language]
    ?? { title: site.name, description: site.document.description };
  const title = escapeHtml(copy.title);
  const description = escapeHtml(copy.description);
  const origin = site.document.origin;
  const currentUrl = origin ? pageUrl(language, path) : null;
  const shareImage = origin ? new URL(site.document.shareImage ?? site.heroImageUrl, origin).href : null;
  const alternates = origin ? ['fr', 'en'].map((alternate) =>
    `<link rel="alternate" hreflang="${alternate}" href="${escapeHtml(pageUrl(alternate, path))}">`).join('\n') : '';
  const metadata = currentUrl ? `
    <link rel="canonical" href="${escapeHtml(currentUrl)}">
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(pageUrl(site.defaultLanguage ?? 'fr', path))}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="${escapeHtml(site.name)}">
    ${site.document.locales ? `<meta property="og:locale" content="${escapeHtml(site.document.locales[language])}">
    <meta property="og:locale:alternate" content="${escapeHtml(site.document.locales[language === 'fr' ? 'en' : 'fr'])}">` : ''}
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${escapeHtml(currentUrl)}">
    <meta property="og:image" content="${escapeHtml(shareImage)}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="${escapeHtml(shareImage)}">
    <script id="site-organization" type="application/ld+json">${JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Organization',
      name: site.name, url: origin, image: shareImage,
    }).replaceAll('<', '\\u003c')}</script>` : '';
  const navigation = pages.map(([key, suffix]) =>
    `<a href="/${language}/${suffix ? `${suffix}/` : ''}">${escapeHtml(site.document.pages?.[key]?.[language]?.title ?? key)}</a>`).join(' ');
  // This paints before the application module runs. The native disclosure also
  // keeps the localized content and links available without JavaScript.
  const mediaStartup = site.startupPresentation === 'media' && (page === 'home' || page === 'about');
  const fallback = `<main class="site-startup${mediaStartup ? ' site-startup--media' : ''}">
    <section class="site-startup__identity" aria-label="${escapeHtml(startupCopy[language].loading)}">
      <p class="site-startup__brand">${escapeHtml(site.name)}</p>
      <span class="site-startup__rule" aria-hidden="true"></span>
    </section>
    <details class="site-startup__fallback">
      <summary>${escapeHtml(startupCopy[language].navigation)}</summary>
      <section class="site-startup__content"><h1>${title}</h1><p>${description}</p><nav aria-label="${escapeHtml(startupCopy[language].navigation)}">${navigation}</nav></section>
    </details>
  </main>`;
  return shell.replace(/(<html\b[^>]*\blang=")[^"]*(")/u, `$1${language}$2`)
    .replace(/<title>[^<]*<\/title>/u, `<title>${title}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/u, `$1${description}$2`)
    .replace('</head>', `${metadata}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${fallback}</div>`);
}

for (const language of ['fr', 'en']) {
  for (const [page, path] of pages) {
    const directory = join(output, language, path);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'index.html'), documentFor(language, page, path));
  }
}
await writeFile(join(output, 'index.html'), documentFor(site.defaultLanguage ?? 'fr', 'home', ''));

// Keep public HTML asset-first while unknown URLs receive a real 404 from the edge.
for (const language of ['fr', 'en']) {
  const copy = startupCopy[language];
  const html = shell.replace(/(<html\b[^>]*\blang=")[^"]*(")/u, `$1${language}$2`)
    .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(copy.notFound)} | ${escapeHtml(site.name)}</title>`)
    .replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>')
    .replace('<div id="root"></div>', `<div id="root"><main class="site-startup"><section class="site-startup__identity"><p class="site-startup__brand">${escapeHtml(site.name)}</p><h1>${escapeHtml(copy.notFound)}</h1><p>${escapeHtml(copy.notFoundLead)}</p><a href="/${language}/">${escapeHtml(copy.home)}</a></section></main></div>`);
  await writeFile(join(output, language, '404.html'), html);
  if (language === (site.defaultLanguage ?? 'fr')) await writeFile(join(output, '404.html'), html);
}
const language = site.defaultLanguage ?? 'fr';
const directoryHtml = documentFor(language, 'home', '')
  .replace(/<link rel="(?:canonical|alternate)"[^>]*>/gu, '')
  .replace(/<title>[^<]*<\/title>/u, `<title>${escapeHtml(startupCopy[language].galleries)} | ${escapeHtml(site.name)}</title>`)
  .replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
await writeFile(join(output, 'galleries.html'), directoryHtml);
