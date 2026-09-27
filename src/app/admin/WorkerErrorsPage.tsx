import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { WorkerErrorListSchema } from '../../shared/schemas/workerErrors';
import { MediaDiagnosticPageSchema } from '../../shared/schemas/mediaDiagnostics';
import { Button, InfiniteLoadMore, Spinner } from '../components';
import { useAdminAccess } from './AdminAccessContext';

async function getWorkerErrors(before: number | null) {
  const params = before ? `?before=${before}` : '';
  const response = await fetch(`/api/v1/admin/worker-errors${params}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Worker error list returned ${response.status}`);
  return WorkerErrorListSchema.parse(await response.json());
}

type MediaScope = 'galleries' | 'services' | 'portfolio';

async function getMediaDiagnostics(scope: MediaScope, cursor: string | null) {
  const params = new URLSearchParams({ scope });
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`/api/v1/admin/diagnostics/media?${params}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Media diagnostics returned ${response.status}`);
  return MediaDiagnosticPageSchema.parse(await response.json());
}

export function WorkerErrorsPage() {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const [scope, setScope] = useState<MediaScope | null>(null);
  const query = useInfiniteQuery({
    queryKey: ['worker-errors'], initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => getWorkerErrors(pageParam),
    getNextPageParam: (page) => page.nextBefore,
    enabled: !readOnly,
  });
  const media = useInfiniteQuery({
    queryKey: ['media-diagnostics', scope], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getMediaDiagnostics(scope ?? 'galleries', pageParam),
    getNextPageParam: (page) => page.nextCursor,
    enabled: !readOnly && scope !== null,
  });

  if (readOnly) return <p role="alert">{t('admin.diagnostics.denied')}</p>;
  const errors = query.data?.pages.flatMap((page) => page.errors) ?? [];
  const untracked = media.data?.pages.flatMap((page) => page.untracked) ?? [];
  const lastMediaPage = media.data?.pages.at(-1);
  return <section className="admin-workspace admin-card">
    <h1 className="admin-card__title">{t('admin.diagnostics.title')}</h1>
    <p className="admin-card__description">{t('admin.diagnostics.description')}</p>
    {query.isPending ? <Spinner label={t('admin.diagnostics.loading')} /> : null}
    {query.isError ? <p role="alert">{t('admin.diagnostics.error')}</p> : null}
    {!query.isPending && !query.isError && errors.length === 0 ? <p>{t('admin.diagnostics.empty')}</p> : null}
    {errors.length > 0 ? <div className="admin-table-scroll">
      <table>
        <thead><tr>
          <th scope="col">{t('admin.diagnostics.time')}</th>
          <th scope="col">{t('admin.diagnostics.route')}</th>
          <th scope="col">{t('admin.diagnostics.code')}</th>
          <th scope="col">{t('admin.diagnostics.request')}</th>
        </tr></thead>
        <tbody>{errors.map((item) => <tr key={item.id}>
          <td>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(item.occurredAt))}</td>
          <td>{item.method} {item.routeGroup}</td>
          <td>{item.code} ({item.category})</td>
          <td><code>{item.requestId}</code></td>
        </tr>)}</tbody>
      </table>
    </div> : null}
    <InfiniteLoadMore error={query.isFetchNextPageError} errorLabel={t('admin.diagnostics.error')}
      hasMore={Boolean(query.hasNextPage)} loadLabel={t('admin.diagnostics.loadMore')}
      loading={query.isFetchingNextPage} loadingLabel={t('admin.diagnostics.loading')}
      onLoadMore={() => { void query.fetchNextPage(); }} />
    <section aria-labelledby="media-diagnostics-heading">
      <h2 id="media-diagnostics-heading">{t('admin.diagnostics.mediaTitle')}</h2>
      <p>{t('admin.diagnostics.mediaDescription')}</p>
      <div className="admin-actions">
        {(['galleries', 'services', 'portfolio'] as const).map((item) =>
          <Button aria-pressed={scope === item} key={item} onClick={() => setScope(item)}
            variant={scope === item ? 'primary' : 'secondary'}>{t(`admin.diagnostics.scope.${item}`)}</Button>)}
      </div>
      {media.isPending && scope ? <Spinner label={t('admin.diagnostics.scanning')} /> : null}
      {media.isError ? <p role="alert">{t('admin.diagnostics.scanError')}</p> : null}
      {lastMediaPage ? <>
        <p>{t('admin.diagnostics.scanStatus', {
          count: media.data?.pages.reduce((total, page) => total + page.scanned, 0) ?? 0,
          pending: lastMediaPage.pendingCleanupJobs,
          running: lastMediaPage.runningCleanupJobs,
          failed: lastMediaPage.failedCleanupJobs,
        })}</p>
        {untracked.length === 0 ? <p>{t('admin.diagnostics.noUntracked')}</p> : <div className="admin-table-scroll">
          <table><thead><tr><th scope="col">{t('admin.diagnostics.objectKey')}</th>
            <th scope="col">{t('admin.diagnostics.uploaded')}</th></tr></thead>
            <tbody>{untracked.map((object) => <tr key={object.key}><td><code>{object.key}</code></td>
              <td>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short', timeStyle: 'short' }).format(new Date(object.uploadedAt))}</td>
            </tr>)}</tbody></table>
        </div>}
        {media.hasNextPage ? <Button disabled={media.isFetchingNextPage} onClick={() => { void media.fetchNextPage(); }}
          variant="secondary">{media.isFetchingNextPage ? t('admin.diagnostics.scanning') : t('admin.diagnostics.scanNext')}</Button> : null}
      </> : null}
    </section>
  </section>;
}
