import { afterEach, describe, expect, it, vi } from 'vitest';

import { FetchImportApi, type ImportRequestError } from '../../../src/browser/jobs/ImportApi';

describe('FetchImportApi', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not call native fetch with the API instance as its receiver', async () => {
    const receivers: unknown[] = [];
    const urls: string[] = [];
    vi.stubGlobal('fetch', function (this: unknown, input: RequestInfo | URL) {
      receivers.push(this);
      urls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      return Promise.resolve(new Response(JSON.stringify({
        code: 'IMPORT_NOT_FOUND', message: 'Not found', requestId: 'request-test',
      }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
    });

    const api = new FetchImportApi();
    await expect(api.cancelImport('import-test')).rejects.toMatchObject({
      code: 'IMPORT_NOT_FOUND', status: 404,
    } satisfies Partial<ImportRequestError>);
    expect(receivers).not.toContain(api);
    expect(urls).toEqual(['/api/v1/admin/imports/import-test/cancel']);
  });
});
