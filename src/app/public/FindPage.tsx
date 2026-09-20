import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';

import type { DetectedFace, FaceInference } from '../../browser/faces';
import type { FaceSearchMatch } from '../../shared/schemas';
import { Button, Spinner } from '../components';
import { getRelatedPhotos, searchEventFaces } from './FindApi';
import { PublicLayout } from './PublicLayout';

type RelatedPhoto = Awaited<ReturnType<typeof getRelatedPhotos>>['photos'][number];

export function FindPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const [consent, setConsent] = useState(false);
  const [image, setImage] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [faces, setFaces] = useState<DetectedFace[]>([]);
  const [selected, setSelected] = useState(0);
  const [engine, setEngine] = useState<FaceInference | null>(null);
  const [embedding, setEmbedding] = useState<number[] | null>(null);
  const [matches, setMatches] = useState<FaceSearchMatch[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [related, setRelated] = useState<RelatedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => {
    image?.close();
    if (preview) URL.revokeObjectURL(preview);
  }, [image, preview]);

  const chooseFile = async (file: File | undefined) => {
    if (!file || !consent) return;
    setError(null);
    image?.close();
    if (preview) URL.revokeObjectURL(preview);
    const nextPreview = URL.createObjectURL(file);
    try {
      const bitmap = await createImageBitmap(file);
      setImage(bitmap);
      setPreview(nextPreview);
      setFaces([]);
      setMatches([]);
      setRelated([]);
      setEmbedding(null);
    } catch {
      URL.revokeObjectURL(nextPreview);
      setError(t('faceFind.unavailable'));
    }
  };

  const analyze = async () => {
    if (!image || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const inference = engine ?? await (await import('../../browser/faces')).FaceInference.load();
      setEngine(inference);
      const detected = await inference.detect(image);
      setFaces(detected);
      setSelected(0);
      if (detected.length === 0) setError(t('faceFind.noFaces'));
    } catch {
      setError(t('faceFind.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  const runSearch = async (nextCursor?: string) => {
    const face = faces[selected];
    if (!image || !engine || !face) return;
    setBusy(true);
    setError(null);
    try {
      const vector = embedding ?? await engine.embed(image, face);
      setEmbedding(vector);
      const response = await searchEventFaces(slug, vector, nextCursor);
      setMatches((current) => {
        const deduplicated = new Map(current.map((match) => [match.photoId, match]));
        for (const match of response.matches) {
          const prior = deduplicated.get(match.photoId);
          if (!prior || match.score > prior.score) deduplicated.set(match.photoId, match);
        }
        return [...deduplicated.values()].sort((left, right) => right.score - left.score);
      });
      setCursor(response.nextCursor);
    } catch {
      setError(t('faceFind.unavailable'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PublicLayout>
      <section className="face-find">
        <Link to={`/e/${slug}`}>{t('faceFind.back')}</Link>
        <h1>{t('faceFind.title')}</h1>
        <p>{t('faceFind.privacy')}</p>
        <label className="face-find__consent">
          <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>{t('faceFind.consent')}</span>
        </label>
        <div className="face-find__actions">
          <label className="button button--primary">
            {t('faceFind.selfie')}
            <input accept="image/jpeg,image/png,image/webp" capture="user" disabled={!consent} hidden onChange={(event) => void chooseFile(event.target.files?.[0])} type="file" />
          </label>
          <Button disabled={!consent} onClick={() => fileInput.current?.click()} variant="secondary">{t('faceFind.choose')}</Button>
          <input accept="image/jpeg,image/png,image/webp" disabled={!consent} hidden onChange={(event) => void chooseFile(event.target.files?.[0])} ref={fileInput} type="file" />
        </div>
        {preview ? <img alt={t('faceFind.imageAlt')} className="face-find__preview" src={preview} /> : null}
        {image ? <Button disabled={busy} onClick={() => void analyze()}>{t('faceFind.analyze')}</Button> : null}
        {busy ? <><Spinner label={t('faceFind.loadingModels')} /><p>{t('faceFind.loadingModels')}</p></> : null}
        {error ? <p role="alert">{error}</p> : null}
        {faces.length > 0 ? (
          <fieldset className="face-find__faces">
            <legend>{t('faceFind.chooseFace')}</legend>
            {faces.map((face, index) => (
              <label key={`${face.box.x}-${face.box.y}`}>
                <input checked={selected === index} name="selected-face" onChange={() => { setSelected(index); setEmbedding(null); setMatches([]); }} type="radio" />
                <span>{t('faceFind.faceNumber', { number: index + 1 })}</span>
              </label>
            ))}
            <Button disabled={busy} onClick={() => void runSearch()}>{t('faceFind.search')}</Button>
          </fieldset>
        ) : null}
        {matches.length > 0 ? (
          <section>
            <h2>{t('faceFind.possibleMatches')}</h2>
            <p>{t('faceFind.possibleHelp')}</p>
            <div className="face-results">
              {matches.map((match) => (
                <button className="face-result" key={match.photoId} onClick={() => void getRelatedPhotos(slug, match.photoId).then((response) => setRelated(response.photos))} type="button">
                  <img alt={t('faceFind.matchAlt')} loading="lazy" src={match.thumbnailUrl} />
                </button>
              ))}
            </div>
            {cursor ? <Button disabled={busy} onClick={() => void runSearch(cursor)}>{t('faceFind.more')}</Button> : null}
          </section>
        ) : embedding && !busy ? <p>{t('faceFind.noMatches')}</p> : null}
        {related.length > 0 ? <section><h2>{t('faceFind.nearby')}</h2><div className="face-results">{related.map((photo) => <Link key={photo.photoId} to={`/e/${slug}/photo/${photo.photoId}`}><img alt={t('faceFind.matchAlt')} loading="lazy" src={photo.thumbnailUrl} /></Link>)}</div></section> : null}
      </section>
    </PublicLayout>
  );
}
