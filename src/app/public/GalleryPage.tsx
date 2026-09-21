import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button, Input, Spinner } from '../components';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { GalleryApiError, getPublicEvent, getPublicPhotos, unlockEvent } from './api';
import { getPublicGalleryConfiguration } from './config';
import { PhotoViewer } from './PhotoViewer';
import { PublicLayout } from './PublicLayout';
import { siteProfile } from './siteProfile';

export function GalleryPage() {
  const { slug = '', photoId } = useParams<{ slug: string; photoId?: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const turnstile = useRef<TurnstileChallengeHandle>(null);
  const [password, setPassword] = useState('');
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
    onSuccess: async () => {
      setPassword('');
      await queryClient.invalidateQueries({ queryKey: ['public-event', slug] });
      await queryClient.invalidateQueries({ queryKey: ['public-photos', slug] });
    },
  });
  const allPhotos = useMemo(() => photos.data?.pages.flatMap((page) => page.photos) ?? [], [photos.data]);
  const selected = photoId ? allPhotos.find((photo) => photo.id === photoId) : undefined;
  const accessRequired = (event.error instanceof GalleryApiError && event.error.status === 401)
    || (photos.error instanceof GalleryApiError && photos.error.status === 401);
  const isPrivateDemo = siteProfile.demo.enabled && slug === siteProfile.demo.privateGallerySlug;
  const unlockForm = (
    <form className="unlock-card" onSubmit={(submitEvent) => { submitEvent.preventDefault(); unlock.mutate(); }}>
      <h2>{t('gallery.protectedTitle')}</h2>
      <p>{t('gallery.protectedHelp')}</p>
      {isPrivateDemo ? (
        <p className="demo-credential">
          <span>{t('gallery.demo.password')}</span>
          <code>{siteProfile.demo.privateGalleryPassword}</code>
        </p>
      ) : null}
      <Input autoComplete="current-password" label={t('gallery.password')} onChange={(changeEvent) => setPassword(changeEvent.target.value)} required type="password" value={password} />
      <TurnstileChallenge ref={turnstile} />
      {unlock.isError ? <p role="alert">{t('gallery.unlockError')}</p> : null}
      <Button disabled={unlock.isPending} type="submit">{t('gallery.unlock')}</Button>
    </form>
  );

  useEffect(() => {
    const selectedIsLast = selected?.id === allPhotos.at(-1)?.id;
    if (!photoId || (!selectedIsLast && selected) || !hasNextPage || isFetchingNextPage) return;
    void fetchNextPage();
  }, [allPhotos, fetchNextPage, hasNextPage, isFetchingNextPage, photoId, selected]);

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
        <p><Link to="/">{t('gallery.backHome')}</Link></p>
        <h1>{event.data.title}</h1>
        {event.data.description ? <p>{event.data.description}</p> : null}
        {event.data.visibility === 'unlisted' ? <p className="gallery-notice">{t('gallery.unlisted')}</p> : null}
        {event.data.retentionDays ? <p className="gallery-meta">{t('gallery.retention', { days: event.data.retentionDays })}</p> : null}
        {event.data.faceSearchEnabled ? <Link className="button button--secondary" to={`/e/${event.data.slug}/find`}>{t('faceFind.open')}</Link> : null}
      </header>

      {accessRequired ? (
        unlockForm
      ) : null}

      {photos.isPending ? <Spinner label={t('gallery.loading')} /> : null}
      {!accessRequired && photos.isError ? <p role="alert">{t('gallery.unavailable')}</p> : null}
      {photos.isSuccess && allPhotos.length === 0 ? <p>{t('gallery.empty')}</p> : null}
      <div className="photo-grid">
        {allPhotos.map((photo) => {
          const sources = [...photo.sources].sort((left, right) => left.width - right.width);
          const fallback = sources[0];
          return (
            <Link aria-label={photo.filename} className="photo-tile" key={photo.id} to={`/e/${event.data.slug}/photo/${photo.id}`}>
              <img
                alt={photo.filename}
                height={photo.height}
                loading="lazy"
                sizes="(max-width: 40rem) 50vw, (max-width: 70rem) 33vw, 25vw"
                src={fallback?.url}
                srcSet={sources.map((source) => `${source.url} ${source.width}w`).join(', ')}
                width={photo.width}
              />
            </Link>
          );
        })}
      </div>
      {photos.hasNextPage ? <Button disabled={photos.isFetchingNextPage} onClick={() => void photos.fetchNextPage()}>{t('gallery.loadMore')}</Button> : null}
      {photoId && !selected && !photos.hasNextPage && !photos.isPending ? <p role="alert">{t('gallery.unavailable')}</p> : null}
      {photoId && selected ? (
        <PhotoViewer
          onClose={() => { void navigate(`/e/${event.data.slug}`); }}
          onSelect={(photo) => { void navigate(`/e/${event.data.slug}/photo/${photo.id}`); }}
          photo={selected}
          photos={allPhotos}
        />
      ) : null}
    </PublicLayout>
  );
}
