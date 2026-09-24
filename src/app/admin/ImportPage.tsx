import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Dropzone, ProgressBar } from '../components';
import {
  FetchImportApi,
  ImportPipeline,
  IndexedDbImportJournal,
  type ImportPipelineSnapshot,
  type RejectedImportFile,
} from '../../browser/jobs';

export interface ImportPageProps {
  eventId: string;
  keepOriginals: boolean;
  timezone: string;
}

const INITIAL_SNAPSHOT: ImportPipelineSnapshot = {
  completedPhotos: 0,
  failedPhotos: 0,
  state: 'idle',
  totalPhotos: 0,
};

/** Admin import screen; mount from the PA admin route at `/admin/galleries/:eventId/import`. */
export function ImportPage({ eventId, keepOriginals, timezone }: ImportPageProps) {
  const { t } = useTranslation();
  const pipeline = useRef<ImportPipeline | undefined>(undefined);
  const [snapshot, setSnapshot] = useState<ImportPipelineSnapshot>(INITIAL_SNAPSHOT);
  const [rejected, setRejected] = useState<RejectedImportFile[]>([]);
  const [resumableImportId, setResumableImportId] = useState<string>();
  const [isReady, setIsReady] = useState(false);
  const [setupError, setSetupError] = useState<string>();

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
        const resumable = await journal.getResumable(eventId);
        if (mounted) setResumableImportId(resumable?.id);
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
  }, [eventId, t]);

  const start = (files: File[]) => {
    if (!pipeline.current) return;
    void pipeline.current
      .start(eventId, files, timezone, keepOriginals)
      .then((result) => {
        setRejected(result.rejected);
        setResumableImportId(undefined);
      })
      .catch((error: unknown) => {
        const message = error instanceof Error && error.message === 'errors.photoQuotaExceeded' ? t('adminImport.quota') : t('adminImport.failed');
        setSetupError(message);
      });
  };

  const resume = () => {
    const importId = snapshot.importId ?? resumableImportId;
    if (!pipeline.current || !importId) return;
    void pipeline.current.resume(importId).catch(() => setSetupError(t('adminImport.failed')));
  };

  const isRunning = snapshot.state === 'preparing' || snapshot.state === 'processing';
  const canPause = snapshot.state === 'processing';
  const canResume = snapshot.state === 'paused' || Boolean(resumableImportId);
  const progressText = `${snapshot.completedPhotos}/${snapshot.totalPhotos}`;

  return (
    <section aria-labelledby="import-title" className="admin-import">
      <h1 id="import-title">{t('adminImport.start')}</h1>
      <Dropzone
        accept="image/jpeg,image/png,image/webp"
        description={t(keepOriginals ? 'adminImport.dropzoneOriginalDescription' : 'adminImport.dropzoneDescription')}
        disabled={!isReady || isRunning}
        label={t('adminImport.dropzoneLabel')}
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
        {isRunning || snapshot.state === 'paused' || snapshot.state === 'failed' ? (
          <Button onClick={() => void pipeline.current?.cancel().catch(() => setSetupError(t('adminImport.failed')))} variant="danger">
            {t('adminImport.cancel')}
          </Button>
        ) : null}
      </div>
      {setupError ? <p role="alert">{setupError}</p> : null}
      {rejected.length > 0 ? (
        <ul>
          {rejected.map((item) => (
            <li key={`${item.file.name}-${item.file.lastModified}`}>
              {item.file.name}: {t(item.code === 'CORRUPT_IMAGE' ? 'adminImport.corruptFile' : item.code === 'ORIGINAL_TOO_LARGE' ? 'adminImport.originalTooLarge' : 'adminImport.unsupportedFile')}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
