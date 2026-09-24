import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { AdminFavoritePhoto, Event } from '../../shared/schemas';
import { BackLink, Button, Spinner } from '../components';
import { choosePhotoDirectory, createPhotoZip, MAX_ZIP_PHOTOS, photoZipFilename, savePhotosSeparately, supportsSeparatePhotoDownloads } from '../public/downloadPhotos';
import { useAdminAccess } from './AdminAccessContext';
import { getFavoritePhotos, replaceFavoritePhoto } from './adminEventsApi';

/** Owner's focused retouching workspace for shared hearts in one private gallery. */
export function AdminFavoritesPage({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const [view, setView] = useState<'retouch' | 'favorites'>('retouch');
  const [downloadError, setDownloadError] = useState(false);
  const [zipResult, setZipResult] = useState<{ url: string; filename: string } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const favorites = useInfiniteQuery({
    queryKey: ['admin-favorites', event.id, view],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getFavoritePhotos(event.id, pageParam, view),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const replacement = useMutation({
    mutationFn: ({ photoId, importId }: { photoId: string; importId: string }) => replaceFavoritePhoto(event.id, photoId, importId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-favorites', event.id] }),
        queryClient.invalidateQueries({ queryKey: ['admin-events'] }),
        queryClient.invalidateQueries({ queryKey: ['admin-cover-photos', event.id] }),
      ]);
    },
  });
  const photos = favorites.data?.pages.flatMap((page) => page.photos) ?? [];
  const total = favorites.data?.pages[0]?.total ?? 0;
  const canSaveFolder = supportsSeparatePhotoDownloads();

  useEffect(() => () => {
    abort.current?.abort();
    if (zipResult) URL.revokeObjectURL(zipResult.url);
  }, [zipResult]);

  const save = async (batch: AdminFavoritePhoto[], mode: 'folder' | 'zip') => {
    if (readOnly || abort.current || batch.length === 0) return;
    const controller = new AbortController();
    abort.current = controller;
    setProgress(0);
    setDownloadError(false);
    setZipResult(null);
    try {
      if (mode === 'folder') {
        const directory = await choosePhotoDirectory();
        await savePhotosSeparately(batch, directory, controller.signal, setProgress, 'owner');
      } else {
        const blob = await createPhotoZip(batch, controller.signal, setProgress, 'owner');
        setZipResult({ url: URL.createObjectURL(blob), filename: photoZipFilename(event.slug) });
      }
    } catch {
      if (!controller.signal.aborted) setDownloadError(true);
    } finally {
      abort.current = null;
      setProgress(null);
    }
  };

  return <div className="admin-workspace admin-favorites">
    <header className="admin-workspace__heading">
      <BackLink to={`/admin/galleries/${event.id}`}>{t('admin.favorites.back')}</BackLink>
      <p className="admin-demo-intro__eyebrow">{t('admin.favorites.eyebrow')}</p>
      <h1>{t('admin.favorites.title', { title: event.title })}</h1>
      <p>{t('admin.favorites.description')}</p>
    </header>
    <section aria-label={t('admin.favorites.listLabel')} className="admin-card">
      <div aria-label={t('admin.favorites.viewLabel')} className="admin-favorites__views" role="group">
        <Button aria-pressed={view === 'retouch'} onClick={() => setView('retouch')} variant={view === 'retouch' ? 'primary' : 'secondary'}>{t('admin.favorites.retouchView')}</Button>
        <Button aria-pressed={view === 'favorites'} onClick={() => setView('favorites')} variant={view === 'favorites' ? 'primary' : 'secondary'}>{t('admin.favorites.favoritesView')}</Button>
      </div>
      {favorites.isPending ? <Spinner label={t('admin.favorites.loading')} /> : null}
      {favorites.isError ? <p role="alert">{t('admin.favorites.error')}</p> : null}
      {favorites.isSuccess ? <p className="admin-favorites__count">{t(view === 'retouch' ? 'admin.favorites.count' : 'admin.favorites.favoriteCount', { count: total })}</p> : null}
      {favorites.isSuccess && total === 0 ? <p>{t(view === 'retouch' ? 'admin.favorites.empty' : 'admin.favorites.favoriteEmpty')}</p> : null}
      {photos.length > 0 && !readOnly ? <div className="admin-favorites__downloads">
        {canSaveFolder ? <Button disabled={progress !== null} onClick={() => void save(photos, 'folder')} variant="secondary">{t('admin.favorites.saveShown', { count: photos.length })}</Button> : null}
        {Array.from({ length: Math.ceil(photos.length / MAX_ZIP_PHOTOS) }, (_, index) => {
          const batch = photos.slice(index * MAX_ZIP_PHOTOS, (index + 1) * MAX_ZIP_PHOTOS);
          return <Button disabled={progress !== null} key={index} onClick={() => void save(batch, 'zip')} variant={canSaveFolder ? 'secondary' : 'primary'}>
            {t('admin.favorites.saveZip', { first: index * MAX_ZIP_PHOTOS + 1, last: index * MAX_ZIP_PHOTOS + batch.length })}
          </Button>;
        })}
        {progress !== null ? <p role="status">{t('admin.favorites.progress', { count: progress })}</p> : null}
        {progress !== null ? <Button onClick={() => abort.current?.abort()} variant="secondary">{t('admin.favorites.cancel')}</Button> : null}
        {zipResult ? <a className="button button--primary" download={zipResult.filename} href={zipResult.url}>{t('admin.favorites.downloadZip')}</a> : null}
        {downloadError ? <p role="alert">{t('admin.favorites.downloadError')}</p> : null}
      </div> : null}
      <div className="admin-favorites__grid">
        {photos.map((photo) => <article className="admin-favorites__photo" key={photo.id}>
          <img alt="" loading="lazy" src={photo.thumbnailUrl} />
          <div className="admin-favorites__photo-body">
            <p className="admin-favorites__filename">{photo.filename}</p>
            {photo.revision > 0 ? <span className="admin-favorites__badge">{t('admin.favorites.updated')}</span> : null}
            <div className="admin-favorites__photo-actions">
              {!readOnly ? <a className="button button--secondary" download href={photo.downloadUrl}>{t('admin.favorites.download')}</a> : null}
              {!readOnly && view === 'retouch' && photo.replaceable ? <Link className="button button--secondary" to={`/admin/galleries/${event.id}/import?replace=${encodeURIComponent(photo.id)}`}>{t('admin.favorites.replace')}</Link> : null}
              {photo.pendingImportId && !readOnly && view === 'retouch' ? <Button disabled={replacement.isPending} onClick={() => replacement.mutate({ photoId: photo.id, importId: photo.pendingImportId! })} variant="primary">{t('admin.favorites.finishReplacement')}</Button> : null}
            </div>
            {view === 'retouch' && !photo.replaceable ? <p className="admin-card__description">{t('admin.favorites.sampleNotReplaceable')}</p> : null}
          </div>
        </article>)}
      </div>
      {replacement.isError ? <p role="alert">{t('admin.favorites.replaceError')}</p> : null}
      {favorites.hasNextPage ? <Button disabled={favorites.isFetchingNextPage} onClick={() => void favorites.fetchNextPage()} variant="secondary">{t('admin.favorites.more')}</Button> : null}
      {readOnly && photos.length > 0 ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
    </section>
  </div>;
}
