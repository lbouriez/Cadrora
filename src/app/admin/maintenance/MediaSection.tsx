import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MediaDiagnosticPageSchema } from '../../../shared/schemas/mediaDiagnostics';
import { Button, Spinner } from '../../components';
import { useAdminAccess } from '../AdminAccessContext';

type MediaScope = 'galleries' | 'services' | 'portfolio';

async function getMediaDiagnostics(scope: MediaScope, cursor: string | null) {
  const params = new URLSearchParams({ scope });
  if (cursor) params.set('cursor', cursor);
  const response = await fetch(`/api/v1/admin/diagnostics/media?${params}`, { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Media diagnostics returned ${response.status}`);
  return MediaDiagnosticPageSchema.parse(await response.json());
}


export function MediaSection() {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const [scope, setScope] = useState<MediaScope | null>(null);
  const media = useInfiniteQuery({
    queryKey: ['media-diagnostics', scope], initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => getMediaDiagnostics(scope ?? 'galleries', pageParam),
    getNextPageParam: (page) => page.nextCursor,
    enabled: !readOnly && scope !== null,
    retry: false, refetchOnWindowFocus: false,
  });

  if (readOnly) return <p role="alert">{t('admin.maintenance.denied')}</p>;
  const untracked = media.data?.pages.flatMap((page) => page.untracked) ?? [];
  const lastMediaPage = media.data?.pages.at(-1);
  return (
    <section aria-labelledby="media-diagnostics-heading">
      <h2 id="media-diagnostics-heading">{t('admin.diagnostics.mediaTitle')}</h2>
      <p>{t('admin.diagnostics.mediaDescription')}</p><p>{t('admin.maintenance.mediaNote')}</p>
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
        {untracked.length === 0 ? <p>{t('admin.diagnostics.noUntracked')}</p> : <div className="admin-table-scroll" role="region" aria-label={t('admin.diagnostics.mediaTitle')} tabIndex={0}>
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
  );
}
