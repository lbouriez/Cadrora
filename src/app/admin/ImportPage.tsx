import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Dropzone, ProgressBar } from '../components';
import {
  FetchImportApi,
  ImportPipeline,
  ImportRequestError,
  IndexedDbImportJournal,
  type ImportJournalJob,
  type ImportPipelineSnapshot,
  type RejectedImportFile,
} from '../../browser/jobs';
import { replaceFavoritePhoto } from './adminEventsApi';

export interface ImportPageProps {
  eventId: string;
  galleryTitle: string;
  keepOriginals: boolean;
  faceSearchEnabled?: boolean;
  timezone: string;
  replacementPhotoId?: string;
}

const INITIAL_SNAPSHOT: ImportPipelineSnapshot = {
  completedPhotos: 0,
  failedPhotos: 0,
  state: 'idle',
  totalPhotos: 0,
};

/** Admin import screen; mount from the PA admin route at `/admin/galleries/:eventId/import`. */
export function ImportPage({ eventId, galleryTitle, keepOriginals, faceSearchEnabled = false, timezone, replacementPhotoId }: ImportPageProps) {
  const { t } = useTranslation();
  const pipeline = useRef<ImportPipeline | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<ImportPipelineSnapshot>(INITIAL_SNAPSHOT);
  const [rejected, setRejected] = useState<RejectedImportFile[]>([]);
  const [resumableJob, setResumableJob] = useState<ImportJournalJob>();
  const [isReady, setIsReady] = useState(false);
  const [setupError, setSetupError] = useState<string>();
  const [replacementDone, setReplacementDone] = useState(false);
  const [replacementError, setReplacementError] = useState(false);
  const [replacementBusy, setReplacementBusy] = useState(false);
  const replacementAttempted = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void IndexedDbImportJournal.open()
      .then(async (journal) => {
        if (!mounted) return;
        pipeline.current = new ImportPipeline({
          api: new FetchImportApi(),
          journal,
          onChange: setSnapshot,
        });
        setIsReady(true);
        const resumable = await journal.getResumable(eventId, replacementPhotoId);
        if (mounted) setResumableJob(resumable);
      })
      .catch(() => {
        if (mounted) {
          setIsReady(false);
          setSetupError(t('adminImport.failed'));
        }
      });
    return () => {
      mounted = false;
    };
  }, [eventId, replacementPhotoId, t]);

  useEffect(() => {
    if (!replacementPhotoId || !snapshot.importId || snapshot.state !== 'completed' ||
      replacementDone || replacementAttempted.current === snapshot.importId) return;
    replacementAttempted.current = snapshot.importId;
    setReplacementBusy(true);
    void replaceFavoritePhoto(eventId, replacementPhotoId, snapshot.importId)
      .then(() => { setReplacementDone(true); setReplacementError(false); })
      .catch(() => { setReplacementError(true); })
      .finally(() => setReplacementBusy(false));
  }, [eventId, replacementPhotoId, replacementDone, snapshot.importId, snapshot.state]);

  const start = (files: File[]) => {
    if (!pipeline.current) return;
    if (replacementPhotoId && files.length !== 1) {
      setSetupError(t('adminImport.replacementSinglePhoto'));
      return;
    }
    setSetupError(undefined);
    void pipeline.current
      .start(eventId, files, timezone, keepOriginals, replacementPhotoId)
      .then((result) => {
        setRejected(result.rejected);
        setResumableJob(undefined);
      })
      .catch((error: unknown) => {
        setSetupError(t(importErrorKey(error)));
      });
  };

  const resume = () => {
    const importId = snapshot.importId ?? resumableJob?.id;
    if (!pipeline.current || !importId) return;
    setSetupError(undefined);
    void pipeline.current.resume(importId).catch((error: unknown) => setSetupError(t(importErrorKey(error))));
  };

  const isRunning = snapshot.state === 'preparing' || snapshot.state === 'processing';
  const canPause = snapshot.state === 'processing';
  const canUseSavedJob = snapshot.state === 'idle' && Boolean(resumableJob);
  const canResume = snapshot.state === 'paused' || snapshot.state === 'failed' || canUseSavedJob;
  const canCancel = isRunning || canResume;
  const progressText = `${snapshot.completedPhotos}/${snapshot.totalPhotos}`;

  return (
    <section aria-labelledby="import-title" className="admin-import">
      <h1 id="import-title">{replacementPhotoId ? t('adminImport.replacementTitle') : t('adminImport.start', { gallery: galleryTitle })}</h1>
      {replacementPhotoId ? <p>{t('adminImport.replacementDescription')}</p> : null}
      {replacementPhotoId && faceSearchEnabled ? <p className="admin-card__description">{t('adminImport.replacementFaceWarning')}</p> : null}
      <Dropzone
        accept="image/jpeg,image/png,image/webp"
        description={t(keepOriginals ? 'adminImport.dropzoneOriginalDescription' : 'adminImport.dropzoneDescription')}
        disabled={!isReady || isRunning || replacementDone || replacementBusy}
        label={t(replacementPhotoId ? 'adminImport.replacementDropzone' : 'adminImport.dropzoneLabel')}
        onFiles={start}
      />
      {snapshot.state !== 'idle' ? (
        <div className="admin-import__progress">
          <ProgressBar label={t('adminImport.progress')} max={snapshot.totalPhotos} value={snapshot.completedPhotos} valueText={progressText} />
          <p>{progressText}</p>
          {snapshot.etaSeconds !== undefined ? <p>{t('adminImport.eta', { seconds: snapshot.etaSeconds })}</p> : null}
        </div>
      ) : null}
      <div className="admin-import__actions">
        {canPause ? <Button onClick={() => void pipeline.current?.pause()}>{t('adminImport.pause')}</Button> : null}
        {canResume ? <Button onClick={resume}>{t('adminImport.resume')}</Button> : null}
        {canCancel ? (
          <Button onClick={() => void pipeline.current?.cancel(resumableJob).then(() => { setResumableJob(undefined); setSetupError(undefined); }).catch((error: unknown) => {
            reportImportFailure('cancel', error);
            setSetupError(t('adminImport.cancelFailed'));
          })} variant="danger">
            {t('adminImport.cancel')}
          </Button>
        ) : null}
      </div>
      {setupError ? <p role="alert">{setupError}</p> : null}
      {replacementBusy ? <p role="status">{t('adminImport.replacementFinishing')}</p> : null}
      {replacementDone ? <p role="status">{t('adminImport.replacementDone')} <Link to={`/admin/galleries/${eventId}/selections`}>{t('adminImport.replacementBack')}</Link></p> : null}
      {replacementError && snapshot.importId ? <div><p role="alert">{t('adminImport.replacementError')}</p><Button onClick={() => { replacementAttempted.current = null; setReplacementError(false); }} variant="secondary">{t('adminImport.replacementRetry')}</Button></div> : null}
      {rejected.length > 0 ? (
        <ul>
          {rejected.map((item) => (
            <li key={`${item.file.name}-${item.file.lastModified}`}>
              {item.file.name}: {t(item.code === 'CORRUPT_IMAGE' ? 'adminImport.corruptFile' : item.code === 'DUPLICATE_IMAGE' ? 'adminImport.duplicateFile' : item.code === 'ORIGINAL_TOO_LARGE' ? 'adminImport.originalTooLarge' : 'adminImport.unsupportedFile')}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function importErrorKey(error: unknown): 'adminImport.authExpired' | 'adminImport.galleryUnavailable' | 'adminImport.quota' | 'adminImport.storageQuota' | 'adminImport.duplicateConflict' | 'adminImport.failed' {
  if (!(error instanceof ImportRequestError)) return 'adminImport.failed';
  if (error.code === 'ADMIN_AUTH_REQUIRED') return 'adminImport.authExpired';
  if (error.code === 'EVENT_NOT_FOUND') return 'adminImport.galleryUnavailable';
  if (error.code === 'PHOTO_QUOTA_EXCEEDED') return 'adminImport.quota';
  if (error.code === 'STORAGE_QUOTA_EXCEEDED') return 'adminImport.storageQuota';
  if (error.code === 'PHOTO_DUPLICATE_CONFLICT') return 'adminImport.duplicateConflict';
  return 'adminImport.failed';
}

function reportImportFailure(operation: 'cancel', error: unknown): void {
  // Never log the exception message: browser/provider errors can include filenames or request details.
  console.warn('cadrora_import_operation_failed', JSON.stringify({
    operation,
    category: error instanceof Error ? error.name : 'unknown',
    ...(error instanceof ImportRequestError ? { code: error.code, status: error.status } : {}),
  }));
}
