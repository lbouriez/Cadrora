import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { BackLink, Button, FavoriteButton, IconButton, InfoIcon, Input, RetouchButton, Spinner } from '../components';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { GalleryApiError, getPublicEvent, getPublicGalleryIndex, getPublicPhotos, setPhotoFavorite, setPhotoRetouchSelection, unlockEvent } from './api';
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
  downloadHelpId: string;
  favoritesEnabled: boolean;
  favoritePendingId: string | null;
  onToggleFavorite: (photo: PublicPhoto) => void;
  onToggleRetouch: (photo: PublicPhoto) => void;
  retouchPendingId: string | null;
  onToggleSelection: (id: string, shiftKey: boolean) => void;
  onUnavailablePhoto: () => void;
  photos: PublicPhoto[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  slug: string;
  viewerQuery: string;
}

function photoColumnCount(width: number): number {
  return width >= 1320 ? 3 : width >= 720 ? 2 : 1;
}

function GalleryPhotoGrid({ downloadHelpId, favoritesEnabled, favoritePendingId, onToggleFavorite, onToggleRetouch, retouchPendingId, onToggleSelection, onUnavailablePhoto, photos, selectedIds, selectionMode, slug, viewerQuery }: GalleryPhotoGridProps) {
  const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(() => typeof window === 'undefined' ? 1 : photoColumnCount(window.innerWidth - 32));
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry?.contentRect.width ?? 0;
      setColumnCount(photoColumnCount(width));
    });
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);
  const activeColumnCount = Math.min(columnCount, Math.max(photos.length, 1));
  const columnWidths = useMemo(() => activeColumnCount === 3 ? [1.18, 1, 1] : activeColumnCount === 2 ? [1.1, 1] : [1], [activeColumnCount]);
  const columns = useMemo(() => {
    const result = Array.from({ length: activeColumnCount }, () => [] as PublicPhoto[]);
    const heights = Array.from({ length: activeColumnCount }, () => 0);
    for (const photo of photos) {
      const shortest = heights.indexOf(Math.min(...heights));
      result[shortest]?.push(photo);
      heights[shortest] = (heights[shortest] ?? 0) + (photo.height / photo.width) * (columnWidths[shortest] ?? 1);
    }
    return result;
  }, [activeColumnCount, columnWidths, photos]);
  return (
    <div className="photo-grid" ref={gridRef} style={{ gridTemplateColumns: columnWidths.map((width) => `minmax(0, ${width}fr)`).join(' ') }}>
      {columns.map((column, columnIndex) => <div className="photo-grid__column" key={columnIndex}>
      {column.map((photo) => {
        const sources = [...photo.sources].sort((left, right) => left.width - right.width);
        const fallback = sources[0];
        const image = (
          <img
            alt={photo.filename}
            height={photo.height}
            loading="lazy"
            sizes="(max-width: 45rem) 100vw, (max-width: 82rem) 50vw, 33vw"
            src={fallback?.url}
            srcSet={sources.map((source) => `${source.url} ${source.width}w`).join(', ')}
            width={photo.width}
          />
        );
        return (
          <div className="photo-tile-shell" key={photo.id}>
          {selectionMode ? <button
            aria-label={t(photo.downloadUrl ? 'gallery.downloadSelection.photo' : 'gallery.downloadSelection.unavailablePhoto', { filename: photo.filename })}
            aria-pressed={photo.downloadUrl ? selectedIds.has(photo.id) : undefined}
            aria-controls={photo.downloadUrl ? undefined : downloadHelpId}
            className={`photo-tile photo-tile--selectable${photo.downloadUrl ? '' : ' photo-tile--unavailable'}`}
            onClick={(clickEvent) => photo.downloadUrl ? onToggleSelection(photo.id, clickEvent.shiftKey) : onUnavailablePhoto()}
            type="button"
          >
            {image}
            <span aria-hidden="true" className="photo-tile__check">{photo.downloadUrl ? '✓' : <InfoIcon />}</span>
          </button> : <Link aria-label={photo.filename} className="photo-tile" to={`/e/${slug}/photo/${photo.id}${viewerQuery}`}>
            {image}
          </Link>}
          {!selectionMode && favoritesEnabled ? <FavoriteButton
            className="photo-tile__favorite"
            disabled={favoritePendingId !== null}
            label={t(photo.liked ? 'gallery.favorite.remove' : 'gallery.favorite.add', { filename: photo.filename })}
            liked={photo.liked}
            onToggle={() => onToggleFavorite(photo)}
          /> : null}
          {!selectionMode && favoritesEnabled ? <RetouchButton
            className="photo-tile__retouch"
            disabled={retouchPendingId !== null}
            label={t(photo.selectedForRetouch ? 'gallery.retouch.remove' : 'gallery.retouch.add', { filename: photo.filename })}
            onToggle={() => onToggleRetouch(photo)}
            selected={photo.selectedForRetouch}
          /> : null}
          </div>
        );
      })}
      </div>)}
    </div>
  );
}

export function GalleryPage() {
  const { slug = '', photoId } = useParams<{ slug: string; photoId?: string }>();
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const turnstile = useRef<TurnstileChallengeHandle>(null);
  const [password, setPassword] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showDownloadHelp, setShowDownloadHelp] = useState(false);
  const downloadHelpId = useId();
  const lastSelectedId = useRef<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [zipResult, setZipResult] = useState<{ filename: string; url: string } | null>(null);
  const downloadAbort = useRef<AbortController | null>(null);
  const event = useQuery({ queryKey: ['public-event', slug], queryFn: () => getPublicEvent(slug), enabled: slug.length > 0 });
  const publicIndex = useQuery({
    queryKey: ['public-gallery-index'], queryFn: getPublicGalleryIndex,
    enabled: event.error instanceof GalleryApiError && event.error.status === 401,
  });
  const photos = useInfiniteQuery({
    queryKey: ['public-photos', slug, event.data?.revision],
    queryFn: ({ pageParam }) => getPublicPhotos(slug, pageParam ?? undefined),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: Boolean(event.data),
  });
  const favorite = useMutation({
    mutationFn: ({ photo, liked }: { photo: PublicPhoto; liked: boolean }) => setPhotoFavorite(slug, photo.id, liked),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['public-photos', slug] });
    },
  });
  const retouch = useMutation({
    mutationFn: ({ photo, selected }: { photo: PublicPhoto; selected: boolean }) => setPhotoRetouchSelection(slug, photo.id, selected),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['public-photos', slug] }); },
  });
  const onToggleFavorite = (photo: PublicPhoto) => {
    if (favorite.isPending || event.data?.access !== 'protected') return;
    favorite.mutate({ photo, liked: !photo.liked });
  };
  const onToggleRetouch = (photo: PublicPhoto) => {
    if (retouch.isPending || event.data?.access !== 'protected') return;
    retouch.mutate({ photo, selected: !photo.selectedForRetouch });
  };
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
  const downloadablePhotos = useMemo(() => visiblePhotos.filter((photo) => photo.downloadUrl), [visiblePhotos]);
  const supportsFolder = supportsSeparatePhotoDownloads();
  const gridFavorites = { favoritesEnabled: event.data?.access === 'protected', favoritePendingId: favorite.isPending ? favorite.variables.photo.id : null, onToggleFavorite,
    retouchPendingId: retouch.isPending ? retouch.variables.photo.id : null, onToggleRetouch };

  useEffect(() => { lastSelectedId.current = null; }, [matchesView]);

  useEffect(() => () => {
    if (zipResult) URL.revokeObjectURL(zipResult.url);
  }, [zipResult]);

  useEffect(() => () => downloadAbort.current?.abort(), []);

  const resetDownloadResult = () => {
    setZipResult(null);
    setDownloadError(null);
    setDownloadComplete(false);
  };

  const toggleSelection = (id: string, shiftKey: boolean) => {
    if (downloadAbort.current) return;
    const targetIndex = visiblePhotos.findIndex((photo) => photo.id === id && photo.downloadUrl);
    if (targetIndex < 0) return;
    resetDownloadResult();
    const anchorIndex = shiftKey && lastSelectedId.current
      ? visiblePhotos.findIndex((photo) => photo.id === lastSelectedId.current && photo.downloadUrl)
      : -1;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (anchorIndex >= 0) {
        for (const photo of visiblePhotos.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1)) {
          if (photo.downloadUrl) next.add(photo.id);
        }
      } else if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    lastSelectedId.current = id;
  };

  useEffect(() => {
    if (!selectionMode || photoId) return;
    const onSelectAll = (keyEvent: KeyboardEvent) => {
      if (keyEvent.defaultPrevented || keyEvent.altKey || !(keyEvent.ctrlKey || keyEvent.metaKey) || keyEvent.key.toLowerCase() !== 'a') return;
      const target = keyEvent.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select'))) return;
      if (downloadAbort.current || downloadablePhotos.length === 0) return;
      keyEvent.preventDefault();
      setZipResult(null);
      setDownloadError(null);
      setDownloadComplete(false);
      setSelectedIds((current) => new Set([...current, ...downloadablePhotos.map((photo) => photo.id)]));
      lastSelectedId.current = null;
    };
    document.addEventListener('keydown', onSelectAll);
    return () => document.removeEventListener('keydown', onSelectAll);
  }, [downloadablePhotos, photoId, selectionMode]);

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
  const lockedPreview = publicIndex.data?.protectedGalleries.find((gallery) => gallery.id === slug || gallery.slug === slug);
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
    robots.content = event.data?.visibility === 'unlisted' || event.data?.access === 'protected' || accessRequired
      ? 'noindex,nofollow'
      : 'index,follow';
  }, [accessRequired, event.data?.access, event.data?.visibility]);

  if (event.isPending) return <PublicLayout><Spinner label={t('gallery.loading')} /></PublicLayout>;
  if (accessRequired && !event.data) return <PublicLayout wide>
    {lockedPreview ? <header className="gallery-heading">
      <BackLink to="/galleries">{t('gallery.backGalleries')}</BackLink>
      <div className="gallery-heading__hero gallery-heading__hero--without-cover">
        <div className="gallery-heading__copy">
          <p className="gallery-heading__eyebrow">{t('gallery.headingPrivate')}</p>
          <h1>{lockedPreview.title}</h1>
          <p className="gallery-heading__date">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(lockedPreview.startsAt))}</p>
          {lockedPreview.description ? <p className="gallery-heading__description">{lockedPreview.description}</p> : null}
        </div>
      </div>
    </header> : null}
    {unlockForm}
  </PublicLayout>;
  if (event.isError || !event.data) return <PublicLayout><p role="alert">{t('gallery.unavailable')}</p></PublicLayout>;

  return (
    <PublicLayout wide>
      <header className="gallery-heading">
        <BackLink to="/galleries">{t('gallery.backGalleries')}</BackLink>
        <div className={`gallery-heading__hero${event.data.coverPhotoUrl ? '' : ' gallery-heading__hero--without-cover'}`}>
          <div className="gallery-heading__copy">
            <p className="gallery-heading__eyebrow">{t(event.data.access === 'protected' ? 'gallery.headingPrivate' : 'gallery.headingEyebrow')}</p>
            <h1>{event.data.title}</h1>
            <p className="gallery-heading__date">{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(new Date(event.data.startsAt))}</p>
            {event.data.description ? <p className="gallery-heading__description">{event.data.description}</p> : null}
            <div className="gallery-heading__actions">
              <a className="button button--primary" href="#gallery-photos">{t('gallery.browsePhotos')}</a>
              {event.data.faceSearchEnabled ? <Link className="button button--secondary" to={`/e/${event.data.slug}/find`}>{t('faceFind.open')}</Link> : null}
              {event.data.allowDownloads && allPhotos.some((photo) => photo.downloadUrl) ? (
                <Button disabled={downloadProgress !== null} onClick={() => { setSelectionMode((current) => !current); setSelectedIds(new Set()); setShowDownloadHelp(false); lastSelectedId.current = null; resetDownloadResult(); }} variant="secondary">
                  {selectionMode ? t('gallery.downloadSelection.done') : t('gallery.downloadSelection.start')}
                </Button>
              ) : null}
            </div>
            {event.data.access === 'protected' ? <p className="gallery-heading__hint">{t('gallery.retouch.help')}</p> : null}
          </div>
          {event.data.coverPhotoUrl ? <img alt="" className="gallery-heading__cover" src={event.data.coverPhotoUrl} /> : null}
        </div>
        {event.data.visibility === 'unlisted' ? <p className="gallery-notice">{t('gallery.unlisted')}</p> : null}
        {event.data.retentionDays ? <p className="gallery-meta">{t('gallery.retention', { days: event.data.retentionDays })}</p> : null}
        {foundPhotoIds.length > 0 ? (
          <div aria-label={t('gallery.photoFilter.label')} className="gallery-filter" role="group">
            <button aria-pressed={!matchesView} onClick={() => setSearchParams({})} type="button">{t('gallery.photoFilter.all')}</button>
            <button aria-pressed={matchesView} onClick={() => setSearchParams({ view: 'matches' })} type="button">
              {t('gallery.photoFilter.matches', { count: foundPhotoIds.length })}
            </button>
          </div>
        ) : null}
      </header>

      {favorite.isError ? <p role="alert">{t('gallery.favorite.error')}</p> : null}
      {retouch.isError ? <p role="alert">{t('gallery.retouch.error')}</p> : null}

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
            <div className="gallery-download-selection__select-all">
              <Button disabled={downloadProgress !== null || downloadablePhotos.length === 0} onClick={() => { resetDownloadResult(); setSelectedIds((current) => new Set([...current, ...downloadablePhotos.map((photo) => photo.id)])); lastSelectedId.current = null; }} variant="secondary">
                {t('gallery.downloadSelection.selectVisible')}
              </Button>
              <IconButton aria-controls={downloadHelpId} aria-expanded={showDownloadHelp} aria-label={t('gallery.downloadSelection.helpLabel')} onClick={() => setShowDownloadHelp((current) => !current)}><InfoIcon /></IconButton>
            </div>
            <Button disabled={downloadProgress !== null || selectedPhotos.length === 0} onClick={() => { setSelectedIds(new Set()); lastSelectedId.current = null; resetDownloadResult(); }} variant="secondary">
              {t('gallery.downloadSelection.clear')}
            </Button>
            {selectedPhotos.length === 1 ? <a className="button button--primary" download href={selectedPhotos[0]?.downloadUrl ?? undefined}>{t('gallery.download')}</a> : null}
            {selectedPhotos.length > 1 && supportsFolder ? (
              <Button disabled={downloadProgress !== null} onClick={() => void beginDownload('folder')} variant={downloadError === 'folder' ? 'secondary' : 'primary'}>
                {t('gallery.downloadSelection.saveSeparate', { count: selectedPhotos.length })}
              </Button>
            ) : null}
            {selectedPhotos.length > 1 ? (
              <Button disabled={downloadProgress !== null || selectedPhotos.length > MAX_ZIP_PHOTOS} onClick={() => void beginDownload('zip')} variant={supportsFolder && downloadError !== 'folder' ? 'secondary' : 'primary'}>
                {t('gallery.downloadSelection.makeZip', { count: selectedPhotos.length })}
              </Button>
            ) : null}
            {downloadProgress !== null ? <Button onClick={() => downloadAbort.current?.abort()} variant="secondary">{t('gallery.downloadSelection.cancel')}</Button> : null}
            {zipResult ? <a className="button button--primary" download={zipResult.filename} href={zipResult.url}>{t('gallery.downloadSelection.saveZip')}</a> : null}
          </div>
          <p className="gallery-download-selection__help" hidden={!showDownloadHelp} id={downloadHelpId}>{t('gallery.downloadSelection.help', { available: downloadablePhotos.length, total: visiblePhotos.length })}</p>
          {downloadProgress !== null ? <p role="status">{t('gallery.downloadSelection.progress', { current: downloadProgress, total: selectedPhotos.length })}</p> : null}
          {downloadComplete ? <p role="status">{t('gallery.downloadSelection.complete', { count: selectedPhotos.length })}</p> : null}
          {downloadError ? <p role="alert">{t(`gallery.downloadSelection.errors.${downloadError}`)}</p> : null}
          {selectedPhotos.length > MAX_ZIP_PHOTOS ? <p>{t('gallery.downloadSelection.zipLimit')}</p> : null}
        </section>
      ) : null}
      <section aria-label={t('gallery.browsePhotos')} id="gallery-photos">
      {matchesView ? (
        <>
          <p className="gallery-filter__summary">{t('gallery.photoFilter.summary', { matchCount: matchedPhotoIds.length, nearbyCount: nearbyPhotoIds.length })}</p>
          <section aria-labelledby="gallery-matches-heading" className="gallery-found-group">
            <div className="gallery-found-group__heading">
              <h2 id="gallery-matches-heading">{t('gallery.photoFilter.matchesHeading')}</h2>
              <span>{matchedPhotoIds.length}</span>
            </div>
            <p>{t('gallery.photoFilter.matchesHelp')}</p>
            <GalleryPhotoGrid {...gridFavorites} downloadHelpId={downloadHelpId} onToggleSelection={toggleSelection} onUnavailablePhoto={() => setShowDownloadHelp(true)} photos={matchedPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />
          </section>
          {nearbyPhotoIds.length > 0 ? (
            <section aria-labelledby="gallery-nearby-heading" className="gallery-found-group gallery-found-group--nearby">
              <div className="gallery-found-group__heading">
                <h2 id="gallery-nearby-heading">{t('gallery.photoFilter.nearbyHeading')}</h2>
                <span>{nearbyPhotoIds.length}</span>
              </div>
              <p>{t('gallery.photoFilter.nearbyHelp')}</p>
              <GalleryPhotoGrid {...gridFavorites} downloadHelpId={downloadHelpId} onToggleSelection={toggleSelection} onUnavailablePhoto={() => setShowDownloadHelp(true)} photos={nearbyPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />
            </section>
          ) : null}
        </>
      ) : <GalleryPhotoGrid {...gridFavorites} downloadHelpId={downloadHelpId} onToggleSelection={toggleSelection} onUnavailablePhoto={() => setShowDownloadHelp(true)} photos={allPhotos} selectedIds={selectedIds} selectionMode={selectionMode} slug={event.data.slug} viewerQuery={viewerQuery} />}
      {matchesView && photos.hasNextPage && visiblePhotos.length < foundPhotoIds.length ? <Spinner label={t('gallery.photoFilter.loading')} /> : null}
      {!matchesView && photos.hasNextPage ? <Button disabled={photos.isFetchingNextPage} onClick={() => void photos.fetchNextPage()}>{t('gallery.loadMore')}</Button> : null}
      {matchesView && !photos.hasNextPage && visiblePhotos.length === 0 ? <p>{t('gallery.photoFilter.empty')}</p> : null}
      </section>
      {photoId && !selected && !photos.hasNextPage && !photos.isPending ? <p role="alert">{t('gallery.unavailable')}</p> : null}
      {photoId && selected ? (
        <PhotoViewer
          onClose={() => {
            void navigate(returnToFind ? `/e/${event.data.slug}/find#face-search-results` : `/e/${event.data.slug}${matchesView ? '?view=matches' : ''}`);
          }}
          onSelect={(photo) => { void navigate(`/e/${event.data.slug}/photo/${photo.id}${viewerQuery}`); }}
          photo={selected}
          photos={matchesView ? visiblePhotos : allPhotos}
          favoriteEnabled={event.data.access === 'protected'}
          favoritePending={favorite.isPending}
          retouchPending={retouch.isPending}
          onToggleFavorite={onToggleFavorite}
          onToggleRetouch={onToggleRetouch}
          showMetadata={event.data.showPhotoMetadata}
          timezone={event.data.timezone}
        />
      ) : null}
    </PublicLayout>
  );
}
