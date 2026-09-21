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
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraSupported] = useState(() => (
    typeof navigator !== 'undefined'
    && typeof navigator.mediaDevices !== 'undefined'
    && 'getUserMedia' in navigator.mediaDevices
  ));
  const [cameraError, setCameraError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const cameraStream = useRef<MediaStream | null>(null);

  useEffect(() => () => {
    image?.close();
    if (preview) URL.revokeObjectURL(preview);
  }, [image, preview]);

  useEffect(() => () => cameraStream.current?.getTracks().forEach((track) => track.stop()), []);

  useEffect(() => {
    if (!cameraOpen || !video.current || !cameraStream.current) return;
    video.current.srcObject = cameraStream.current;
    void video.current.play().catch(() => undefined);
  }, [cameraOpen]);

  const stopCamera = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOpen(false);
  };

  const startCamera = async () => {
    if (!cameraSupported) {
      setCameraError(t('faceFind.cameraUnavailable'));
      return;
    }
    setCameraError(null);
    try {
      cameraStream.current = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user' } });
      setCameraOpen(true);
    } catch {
      setCameraError(t('faceFind.cameraFailed'));
    }
  };

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

  const captureCamera = async () => {
    const source = video.current;
    if (!source?.videoWidth || !source.videoHeight) {
      setCameraError(t('faceFind.cameraFailed'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = source.videoWidth;
    canvas.height = source.videoHeight;
    canvas.getContext('2d')?.drawImage(source, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
    if (!blob) {
      setCameraError(t('faceFind.cameraFailed'));
      return;
    }
    await chooseFile(new File([blob], 'selfie.jpg', { type: 'image/jpeg' }));
    stopCamera();
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

  const selectFace = (index: number) => {
    setSelected(index);
    setEmbedding(null);
    setMatches([]);
    setRelated([]);
  };

  return (
    <PublicLayout>
      <section className="face-find">
        <Link className="button button--secondary face-find__back" to={`/e/${slug}`}>{t('faceFind.back')}</Link>
        <h1>{t('faceFind.title')}</h1>
        <p>{t('faceFind.privacy')}</p>
        <label className="face-find__consent">
          <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
          <span>{t('faceFind.consent')}</span>
        </label>
        <div className="face-find__actions">
          <Button disabled={!consent || !cameraSupported} onClick={() => void startCamera()}>{t('faceFind.selfie')}</Button>
          <Button disabled={!consent} onClick={() => fileInput.current?.click()} variant="secondary">{t('faceFind.choose')}</Button>
          <input accept="image/jpeg,image/png,image/webp" disabled={!consent} hidden onChange={(event) => void chooseFile(event.target.files?.[0])} ref={fileInput} type="file" />
        </div>
        {!cameraSupported ? <p className="face-find__camera-message">{t('faceFind.cameraUnavailable')}</p> : null}
        {cameraError ? <p className="face-find__camera-message" role="alert">{cameraError}</p> : null}
        {cameraOpen ? <section className="face-find__camera"><p>{t('faceFind.cameraAccess')}</p><video autoPlay muted playsInline ref={video} /><div className="face-find__actions"><Button onClick={() => void captureCamera()}>{t('faceFind.capture')}</Button><Button onClick={stopCamera} variant="secondary">{t('faceFind.cancelCamera')}</Button></div></section> : null}
        <aside className="face-find__test-portraits">
          <h2>{t('faceFind.testPortraits')}</h2>
          <p>{t('faceFind.testPortraitsHelp')}</p>
          <div className="face-find__test-links">
            <a download href="/demo/face-search/test-portrait-amelia.webp">{t('faceFind.testPortraitAmelia')}</a>
            <a download href="/demo/face-search/test-portrait-daniel.webp">{t('faceFind.testPortraitDaniel')}</a>
          </div>
        </aside>
        {preview ? (
          <div className="face-find__preview-stage">
            <img alt={t('faceFind.imageAlt')} className="face-find__preview" src={preview} />
            {image && faces.length > 0 ? (
              <div aria-label={t('faceFind.detectedFaces')} className="face-find__face-overlay">
                {faces.map((face, index) => (
                  <button
                    aria-label={t('faceFind.faceNumber', { number: index + 1 })}
                    aria-pressed={selected === index}
                    className="face-find__face-box"
                    key={`${face.box.x}-${face.box.y}`}
                    onClick={() => selectFace(index)}
                    style={{
                      height: `${Math.min(100, (face.box.height / image.height) * 100)}%`,
                      left: `${Math.max(0, (face.box.x / image.width) * 100)}%`,
                      top: `${Math.max(0, (face.box.y / image.height) * 100)}%`,
                      width: `${Math.min(100, (face.box.width / image.width) * 100)}%`,
                    }}
                    type="button"
                  >
                    <span>{faces.length === 1 ? '✓' : index + 1}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {image ? <Button disabled={busy} onClick={() => void analyze()}>{t('faceFind.analyze')}</Button> : null}
        {busy ? <><Spinner label={t('faceFind.loadingModels')} /><p>{t('faceFind.loadingModels')}</p></> : null}
        {error ? <p role="alert">{error}</p> : null}
        {faces.length > 0 ? (
          <section aria-live="polite" className="face-find__faces">
            <div>
              <h2>{faces.length === 1 ? t('faceFind.oneFaceFound') : t('faceFind.facesFound', { count: faces.length })}</h2>
              <p>{faces.length === 1 ? t('faceFind.oneFaceHelp') : t('faceFind.chooseFace')}</p>
            </div>
            {faces.length > 1 ? <p className="face-find__selected-face">{t('faceFind.selectedFace', { number: selected + 1 })}</p> : null}
            <Button disabled={busy} onClick={() => void runSearch()}>{t('faceFind.search')}</Button>
          </section>
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
