import { MarketingSnapshotSchema } from '../../shared/schemas/marketingSnapshot';
import type { MarketingSnapshot } from '../../shared/schemas/marketingSnapshot';
import { SITE_SETTINGS_SELECT, siteSettingsFromRow } from '../routes/siteSettings';
import type { SiteSettingsRow } from '../routes/siteSettings';
import { SERVICES_SELECT, SERVICE_VARIANTS_SELECT, publicServiceCards, serviceCardsFromRows } from '../routes/services';
import type { ServiceRow, VariantRow } from '../routes/services';

export const MARKETING_DOCUMENT_PATH = /^\/(?:(fr|en)(?:\/services)?\/?)?$/u;

export async function readMarketingSnapshot(db: D1Database, pathname: string): Promise<MarketingSnapshot> {
  // One D1 batch is transactional: settings and published photo variants belong
  // to the same read snapshot. Nothing from admin routes enters this boundary.
  const results = await db.batch([
    db.prepare(SITE_SETTINGS_SELECT), db.prepare(SERVICES_SELECT), db.prepare(SERVICE_VARIANTS_SELECT),
  ]);
  const row = results[0]?.results[0] as SiteSettingsRow | undefined;
  if (!row || results.some((result) => !result.success)) throw new Error('Public snapshot unavailable');
  return MarketingSnapshotSchema.parse({
    version: 1, pathname, language: MARKETING_DOCUMENT_PATH.exec(pathname)?.[1] ?? row.default_language,
    settings: siteSettingsFromRow(row),
    services: publicServiceCards(serviceCardsFromRows(results[1]?.results as ServiceRow[], results[2]?.results as VariantRow[])),
  });
}

export function serializeMarketingSnapshot(snapshot: MarketingSnapshot): string {
  return JSON.stringify(MarketingSnapshotSchema.parse(snapshot)).replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
    .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
}

/** Preview only, deliberately uncached until equivalent performance is proven. */
export async function marketingDocument(request: Request, bindings: CloudflareBindings): Promise<Response | null> {
  const pathname = new URL(request.url).pathname;
  if (!MARKETING_DOCUMENT_PATH.test(pathname) || request.method !== 'GET') return null;
  const started = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const snapshot = await Promise.race([
      readMarketingSnapshot(bindings.DB, pathname),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Public snapshot timeout')), 1_500); }),
    ]);
    const readMs = performance.now() - started;
    // The existing Sessions handler supplies its fail-closed status and redirect.
    if (pathname.includes('/services') && !snapshot.settings.sessionsPageEnabled) return null;
    const template = await bindings.ASSETS.fetch(new Request(new URL(pathname, request.url)));
    if (!template.ok || !template.headers.get('Content-Type')?.includes('text/html')) return null;
    const { renderMarketing } = await import('virtual:cadrora-marketing-renderer');
    const renderingStarted = performance.now();
    const markup = await renderMarketing(snapshot);
    const renderMs = performance.now() - renderingStarted;
    const headers = new Headers(template.headers);
    headers.delete('ETag');
    headers.delete('Content-Length');
    headers.set('Cache-Control', 'no-store, no-transform');
    headers.set('X-Cadrora-Rendering', 'worker-preview');
    headers.set('Server-Timing', `public-data;dur=${readMs.toFixed(1)}, react;dur=${renderMs.toFixed(1)}`);
    const document = new HTMLRewriter()
      .on('html', { element(element) {
        element.setAttribute('data-marketing-render', 'true');
        element.setAttribute('lang', snapshot.language);
        element.setAttribute('data-theme-policy', snapshot.settings.themeMode);
        element.setAttribute('data-theme', snapshot.settings.themeMode === 'dark' ? 'dark' : 'light');
      } })
      .on('#root', { element(element) { element.setInnerContent(markup, { html: true }); } })
      .on('head', { element(element) {
        element.append(`<script type="application/json" id="cadrora-marketing-snapshot">${serializeMarketingSnapshot(snapshot)}</script>`, { html: true });
      } })
      .transform(new Response(template.body, { status: 200, headers }));
    return document;
  } catch {
    // Never print a data payload or make the optional renderer take down Home.
    return null;
  } finally { clearTimeout(timeout); }
}
