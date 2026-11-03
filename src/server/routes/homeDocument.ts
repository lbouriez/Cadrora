import type { Hono } from 'hono';
import { HOME_IMAGE_MARKER, readHomeImageDocument } from '../http/homeImageDocument';
import type { AppEnv } from '../types';

/** Narrow optional Home hint; Contact and all other marketing assets remain asset-first. */
export function registerHomeDocumentRoutes(app: Hono<AppEnv>): void {
  for (const path of ['/', '/fr', '/fr/', '/en', '/en/']) {
    app.get(path, async (context) => {
      const asset = await context.env.ASSETS.fetch(context.req.raw);
      if (!asset.ok || !asset.headers.get('Content-Type')?.includes('text/html')) return asset;
      const template = await asset.text();
      if (!template.includes(HOME_IMAGE_MARKER)) return new Response(template, { status: asset.status, headers: asset.headers });
      const html = await readHomeImageDocument(template, context.env);
      const headers = new Headers(asset.headers);
      // An owner change must not reuse a document carrying the previous photo/copy snapshot.
      headers.set('Cache-Control', 'no-store, no-transform');
      headers.delete('ETag');
      headers.delete('Content-Length');
      return new Response(html, { status: asset.status, headers });
    });
  }
}
