import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { Button, Input, Spinner } from '../components';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { GalleryApiError, getPublicEvent, getPublicPhotos, unlockEvent } from './api';
import { getPublicGalleryConfiguration } from './config';
import { galleryUnlockErrorKey } from './galleryErrors';
import { readFaceSearchResults } from './faceSearchSession';
import {
  choosePhotoDirectory,
  createPhotoZip,
  MAX_ZIP_PHOTOS,
  photoZipFilename,
  PhotoDownloadError,
  savePhotosSeparately,
  supportsSeparatePhotoDownloads,
} from './downloadPhotos';
import { PhotoViewer } from './PhotoViewer';
import { PublicLayout } from './PublicLayout';
import { siteProfile } from './siteProfile';
import type { PublicPhoto } from '../../shared/schemas/gallery';

interface GalleryPhotoGridProps {
  onToggleSelection: (id: string) => void;
  photos: PublicPhoto[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  slug: string;
  viewerQuery: string;
}

function GalleryPhotoGrid({ onToggleSelection, photos, selectedIds, selectionMode, slug, viewerQuery }: GalleryPhotoGridProps) {
  const { t } = useTranslation();
  return (
    <div className="photo-grid">
      {photos.map((photo) => {
        const sources = [...photo.sources].sort((left, right) => left.width - right.width);
        const fallback = sources[0];
        const image = (
          <img
            alt={photo.filename}
            height={photo.height}
            loading="lazy"
            sizes="(max-width: 40rem) 50vw, (max-width: 70rem) 33vw, 25vw"
            src={fallback?.url}
            srcSet={sources.map((source) => `${source.url} ${source.width}w`).join(', ')}
            width={photo.width}
          />
        );
        return selectionMode && photo.downloadUrl ? (
          <button
            aria-label={t('gallery.downloadSelection.photo', { filename: photo.filename })}
            aria-pressed={selectedIds.has(photo.id)}
            className="photo-tile photo-tile--selectable"
            key={photo.id}
            onClick={() => onToggleSelection(photo.id)}
            type="button"
          >
            {image}
            <span aria-hidden="true" className="photo-tile__check">✓</span>
          </button>
        ) : (
          <Link aria-label={photo.filename} className="photo-tile" key={photo.id} to={`/e/${slug}/photo/${photo.id}${viewerQuery}`}>
            {image}
          </Link>
        );
      })}
    </div>
  );
}

export function GalleryPage() {
  const { slug = '', photoId } = useParams<{ slug: string; photoId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const turnstile = useRef<TurnstileChallengeHandle>(null);
  const [password, setPassword] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [zipResult, setZipResult] = useState<{ filename: string; url: string } | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const event = useQuery({ queryKey: ['public-event', slug], queryFn: () => getPublicEvent(slug), enabled: slug.length > 0 });
  const photos = useInfiniteQuery({
    queryKey: ['public-photos', slug, event.data?.revision],
    queryFn: ({ pageParam }) => getPublicPhotos(slug, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: Boolean(event.data),
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = photos;
  const unlock = useMutation({
    mutationFn: async () => {
      const token = turnstile.current
        ? await turnstile.current.requestToken()
        : await getPublicGalleryConfiguration().getTurnstileToken();
      if (!token) throw new Error('Turnstile is unavailable');
      await unlockEvent(slug, password, token);
    },
    onSuccess: () => {
      setPassword('');
      // A successful password exchange must remain successful even if the
      // following protected refetch detects an expired or rejected cookie.
      void queryClient.invalidateQueries({ queryKey: ['public-event', slug] });
      void queryClient.invalidateQueries({ queryKey: ['public-photos', slug] });
    },
  });
  const allPhotos = useMemo(() => photos.data?.pages.flatMap((page) => page.photos) ?? [], [photos.data]);
  const searchResults = useMemo(() => readFaceSearchResults(slug), [slug]);
  const matchedPhotoIds = searchResults.matchedPhotoIds;
  const nearbyPhotoIds = useMemo(() => {
    if (!event.data?.nearbySearchEnabled) return [];
    const matched = new Set(matchedPhotoIds);
    return searchResults.nearbyPhotoIds.filter((id) => !matched.has(id));
  }, [event.data?.nearbySearchEnabled, matchedPhotoIds, searchResults.nearbyPhotoIds]);
  const foundPhotoIds = useMemo(() => [...matchedPhotoIds, ...nearbyPhotoIds], [matchedPhotoIds, nearbyPhotoIds]);
  const matchesView = searchParams.get('view') === 'matches' && foundPhotoIds.length > 0;
  const photosById = useMemo(() => new Map(allPhotos.map((photo) => [photo.id, photo])), [allPhotos]);
  const matchedPhotos = useMemo(() => matchedPhotoIds.flatMap((id) => {
    const photo = photosById.get(id);
    return photo ? [photo] : [];
  }), [matchedPhotoIds, photosById]);
  const nearbyPhotos = useMemo(() => nearbyPhotoIds.flatMap((id) => {
    const photo = photosById.get(id);
    return photo ? [photo] : [];
  }), [nearbyPhotoIds, photosById]);
  const visiblePhotos = useMemo(() => {
    if (!matchesView) return allPhotos;
    const byId = new Map(allPhotos.map((photo) => [photo.id, photo]));
    return foundPhotoIds.flatMap((id) => {
      const photo = byId.get(id);
      return photo ? [photo] : [];
    });
  }, [allPhotos, foundPhotoIds, matchesView]);
  const returnToFind = searchParams.get('return') === 'find';
  const viewerSearch = new URLSearchParams();
  if (matchesView) viewerSearch.set('view', 'matches');
  if (returnToFind) viewerSearch.set('return', 'find');
  const viewerQuery = viewerSearch.size > 0 ? `?${viewerSearch.toString()}` : '';
  const selected = photoId ? allPhotos.find((photo) => photo.id === photoId) : undefined;
  const selectedPhotos = useMemo(() => allPhotos.filter((photo) => selectedIds.has(photo.id) && photo.downloadUrl), [allPhotos, selectedIds]);
  const downloadablePhotos = visiblePhotos.filter((photo) => photo.downloadUrl);
  const supportsFolder = supportsSeparatePhotoDownloads();

  useEffect(() => () => {
    if (zipResult) URL.revokeObjectURL(zipResult.url);
  }, [zipResult]);

  useEffect(() => () => downloadAbort.current?.abort(), []);

  const resetDownloadResult = () => {
    setZipResult(null);
    setDownloadError(null);
    setDownloadComplete(false);
  };

  const toggleSelection = (id: string) => {
    if (downloadAbort.current) return;
    resetDownloadResult();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const beginDownload = async (mode: 'folder' | 'zip') => {
    if (selectedPhotos.length < 2 || downloadAbort.current) return;
    resetDownloadResult();
    const controller = new AbortController();
    downloadAbort.current = controller;
    setDownloadProgress(0);
    try {
      if (mode === 'folder') {
        // The picker runs before any network await so it retains the click's user activation.
        const directory = await choosePhotoDirectory();
        await savePhotosSeparately(selectedPhotos, directory, controller.signal, setDownloadProgress);
        setDownloadComplete(true);
      } else {
        const blob = await createPhotoZip(selectedPhotos, controller.signal, setDownloadProgress);
        if (!controller.signal.aborted) setZipResult({ filename: photoZipFilename(slug), url: URL.createObjectURL(blob) });
      }
    } catch (error) {
      if (!controller.signal.aborted && !(error instanceof DOMException && error.name === 'AbortError')) {
        setDownloadError(error instanceof PhotoDownloadError ? error.code : 'network');
      }
    } finally {
      downloadAbort.current = null;
      setDownloadProgress(null);
    }
  };
  const accessRequired = (event.error instanceof GalleryApiError && event.error.status === 401)
    || (photos.error instanceof GalleryApiError && photos.error.status === 401);
  const isPrivateDemo = siteProfile.demo.enabled && slug === siteProfile.demo.privateGallerySlug;
  const accessError = event.error instanceof GalleryApiError
    ? event.error
    : photos.error instanceof GalleryApiError
      ? photos.error
      : null;
  const accessSessionError = accessError?.code === 'EVENT_GRANT_INVALID'
    || accessError?.code === 'EVENT_GRANT_STALE';
  const unlockErrorKey = galleryUnlockErrorKey(unlock.error);
  const unlockForm = (
    <form className="unlock-card" onSubmit={(submitEvent) => { submitEvent.preventDefault(); unlock.mutate(); }}>
      <h2>{t('gallery.protectedTitle')}</h2>
      <p>{t('gallery.protectedHelp')}</p>
      {accessSessionError ? <p role="alert">{t('gallery.accessSessionError')}</p> : null}
      {isPrivateDemo ? (
        <p className="demo-credential">
          <span>{t('gallery.demo.password')}</span>
          <code>{siteProfile.demo.privateGalleryPassword}</code>
        </p>
      ) : null}
      <Input autoComplete="current-password" label={t('gallery.password')} onChange={(changeEvent) => setPassword(changeEvent.target.value)} required type="password" value={password} />
      <TurnstileChallenge ref={turnstile} />
      {unlock.isError ? <p role="alert">{t(unlockErrorKey)}</p> : null}
      <Button disabled={unlock.isPending} type="submit">{t('gallery.unlock')}</Button>
    </form>
  );

  useEffect(() => {
    const selectedIsLast = selected?.id === allPhotos.at(-1)?.id;
    if (!photoId || (!selectedIsLast && selected) || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [allPhotos, fetchNextPage, hasNextPage, isFetchingNextPage, photoId, selected]);

  useEffect(() => {
    if (!matchesView || visiblePhotos.length >= foundPhotoIds.length || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [fetchNextPage, foundPhotoIds.length, hasNextPage, isFetchingNextPage, matchesView, visiblePhotos.length]);

  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]') ?? document.createElement('meta');
    if (!robots.parentNode) {
      robots.name = 'robots';
      document.head.append(robots);
    }
    robots.content = event.data?.visibility === 'unlisted' || event.data?.access === 'protected'
      ? 'noindex,nofollow'
      : 'index,follow';
  }, [event.data?.access, event.data?.visibility]);

  if (event.isPending) return <PublicLayout><Spinner label={t('gallery.loading')} /></PublicLayout>;
  if (accessRequired && !event.data) return <PublicLayout>{unlockForm}</PublicLayout>;
  if (event.isError || !event.data) return <PublicLayout><p role="alert">{t('gallery.unavailable')}</p></PublicLayout>;

  return (
    <PublicLayout>
      <header className="gallery-heading">
        <Link className="gallery-back" to="/"><span aria-hidden="true">←</span>{t('gallery.backHome')}</Link>
        <h1>{event.data.title}</h1>
        {event.data.description ? <p>{event.data.description}</p> : null}
        {event.data.visibility === 'unlisted' ? <p className="gallery-notice">{t('gallery.unlisted')}</p> : null}
        {event.data.retentionDays ? <p className="gallery-meta">{t('gallery.retention', { days: event.data.retentionDays })}</p> : null}
        {event.data.faceSearchEnabled ? <Link className="button button--secondary" to={`/e/${event.data.slug}/find`}>{t('faceFind.open')}</Link> : null}
        {event.data.allowDownloads && allPhotos.some((photo) => photo.downloadUrl) ? (
          <Button disabled={downloadProgress !== null} onClick={() => { setSelectionMode((current) => !current); setSelectedIds(new Set()); resetDownloadResult(); }} variant="secondary">
            {selectionMode ? t('gallery.downloadSelection.done') : t('gallery.downloadSelection.start')}
          </Button>
        ) : null}
        {foundPhotoIds.length > 0 ? (
          <div aria-label={t('gallery.photoFilter.label')} className="gallery-filter" role="group">
            <button aria-pressed={!matchesView} onClick={() => setSearchParams({})} type="button">{t('gallery.photoFilter.all')}</button>
            <button aria-pressed={matchesView} onClick={() => setSearchParams({ view: 'matches' })} type="button">
              {t('gallery.photoFilter.matches', { count: foundPhotoIds.length })}
            </button>
          </div>
        ) : null}
      </header>

      {accessRequired ? (
        unlockForm
      ) : null}

      {photos.isPending ? <Spinner label={t('gallery.loading')} /> : null}
      {!accessRequired && photos.isError ? <p role="alert">{t('gallery.unavailable')}</p> : null}
      {photos.isSuccess && allPhotos.length === 0 ? <p>{t('gallery.empty')}</p> : null}
      {selectionMode && event.data.allowDownloads ? (
        <section aria-label={t('gallery.downloadSelection.label')} className="gallery-download-selection">
          <p>{t('gallery.downloadSelection.count', { count: selectedPhotos.length })}</p>
          <div className="gallery-download-selection__actions">
            <Button disabled={downloadProgress !== null || downloadablePhotos.length === 0} onClick={() => { resetDownloadResult(); setSelectedIds((current) => new Set([...current, ...downloadablePhotos.map((photo) => photo.id)])); }} variant="secondary">
              {t('gallery.downloadSelection.selectVisible')}
            </Button>
            <Button disabled={downloadProgress !== null || selectedPhotos.length === 0} onClick={() => { setSelectedIds(new Set()); resetDownloadResult(); }} variant="secondary">
              {t('gallery.downloadSelection.clear')}
            </Button>
            {selectedPhotos.length === 1 ? <a className="button button--primary" download href={selectedPhotos[0]?.downloadUrl ?? undefined}>{t('gallery.download')}</a> : null}
            {selectedPhotos.length > 1 && supportsFolder ? (
              <Button disabled={downloadProgress !== null} onClick={() => void beginDownload('folder')}>
                {t('gallery.downloadSelection.saveSeparate', { count: selectedPhotos.length })}
              </Button>
            ) : null}
            {selectedPhotos.length > 1 ? (
              <Button disabled={downloadProgress !== null || selectedPhotos.length > MAX_ZIP_PHOTOS} onClick={() => void beginDownload('zip')} variant={supportsFolder ? 'secondary' : 'primary'}>
                {t('gallery.downloadSelection.makeZip', { count: selectedPhotos.length })}
              </Button>
            ) : null}
            {downloadProgress !== null ? <Button onClick={() => downloadAbort.current?.abort()} variant="secondary">{t('gallery.downloadSelection.cancel')}</Button> : null}
            {zipResult ? <a className="button button--primary" download={zipResult.filename} href={zipResult.url}>{t('gallery.downloadSelection.saveZip')}</a> : null}
          </div>
          {downloadProgress !== null ? <p role="status">{t('gallery.downloadSelection.progress', { current: downloadProgress, total: selectedPhotos.length })}</p> : null}
          {downloadComplete ? <p role="status">{t('gallery.downloadSelection.complete', { count: selectedPhotos.length })}</p> : null}
          {downloadError ? <p role="alert">{t(`gallery.downloadSelection.errors.${downloadError}`)}</p> : null}
          {selectedPhotos.length > MAX_ZIP_PHOTOS ? <p>{t('gallery.downloadSelection.zipLimit')}</p> : null}
          <p className="gallery-download-selection__hint">{t(supportsFolder ? 'gallery.downloadSelection.folderHint' : 'gallery.downloadSelection.zipHint')}</p>
        </section>
      ) : null}
      {matchesView ? (
        <>
          <p className="gallery-filter__summary">{t('gallery.photoFilter.summary', { matchCount: matchedPhotoIds.length, nearbyCount: nearbyPhotoIds.length })}</p>
          <section aria-labelledby="gallery-matches-heading" className="gallery-found-group">
            <div className="gallery-found-group__heading">
              <h2 id="gallery-matches-heading">{t('gallery.photoFilter.matchesHeading')}</h2>
              <span>{matchedPhotoIds.length}</span>
            </div>
            <p>{t('gallery.photoFilter.matchesHelp')}</p>
            <GalleryPhotoGrid onToggleSelection={toggleSelection} photos={matchedPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />
          </section>
          {nearbyPhotoIds.length > 0 ? (
            <section aria-labelledby="gallery-nearby-heading" className="gallery-found-group gallery-found-group--nearby">
              <div className="gallery-found-group__heading">
                <h2 id="gallery-nearby-heading">{t('gallery.photoFilter.nearbyHeading')}</h2>
                <span>{nearbyPhotoIds.length}</span>
              </div>
              <p>{t('gallery.photoFilter.nearbyHelp')}</p>
              <GalleryPhotoGrid onToggleSelection={toggleSelection} photos={nearbyPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />
            </section>
          ) : null}
        </>
      ) : <GalleryPhotoGrid onToggleSelection={toggleSelection} photos={allPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />}
      {matchesView && photos.hasNextPage && visiblePhotos.length < foundPhotoIds.length ? <Spinner label={t('gallery.photoFilter.loading')} /> : null}
      {!matchesView && photos.hasNextPage ? <Button disabled={photos.isFetchingNextPage} onClick={() => void photos.fetchNextPage()}>{t('gallery.loadMore')}</Button> : null}
      {matchesView && !photos.hasNextPage && visiblePhotos.length === 0 ? <p>{t('gallery.photoFilter.empty')}</p> : null}
      {photoId && !selected && !photos.hasNextPage && !photos.isPending ? <p role="alert">{t('gallery.unavailable')}</p> : null}
      {photoId && selected ? (
        <PhotoViewer
          onClose={() => {
            void navigate(returnToFind ? `/e/${event.data.slug}/find#face-search-results` : `/e/${event.data.slug}${matchesView ? '?view=matches' : ''}`);
          }}
          onSelect={(photo) => { void navigate(`/e/${event.data.slug}/photo/${photo.id}${viewerQuery}`); }}
          photo={selected}
          photos={matchesView ? visiblePhotos : allPhotos}
          showMetadata={event.data.showPhotoMetadata}
          timezone={event.data.timezone}
        />
      ) : null}
    </PublicLayout>
  );
}
