import { describe, expect, it } from 'vitest';

import { clientDocumentPath } from '../../../src/server/http/clientDocument';

describe('dynamic client documents', () => {
  it.each(['/admin', '/admin/', '/admin/login', '/admin/settings', '/admin/galleries/abc/import',
    '/admin/galleries/abc/selections', '/admin/portfolio/abc', '/e/wedding', '/e/wedding/',
    '/e/wedding/find', '/e/wedding/photo/123'])('provides a shell for %s after middleware authorization', (path) => {
    expect(clientDocumentPath(path)).toBe('/');
  });

  it.each(['/fr/unknown', '/en/galleries', '/admin/unknown', '/admin/settings/unknown',
    '/e/', '/e/wedding/unknown', '/e/wedding/photo/123/unknown', '/api/v1/unknown',
    '/media/unknown', '/fr/', '/en/contact/', '/galleries'])('leaves %s to its route or static asset status', (path) => {
    expect(clientDocumentPath(path)).toBeNull();
  });
});
