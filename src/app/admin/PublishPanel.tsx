import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { PublicationSummarySchema } from '../../shared/schemas';
import type { PublicationSummary } from '../../shared/schemas';
import { Button } from '../components';
import { i18n } from '../i18n';
import { installPublicationResources } from './publicationResources';
import './publish-panel.css';

installPublicationResources(i18n);

export interface PublishPanelProps {
  eventId: string;
  onPublished?: (summary: PublicationSummary) => void;
  summary: PublicationSummary;
  visibility?: 'published' | 'unlisted';
}

async function publish(eventId: string, visibility: 'published' | 'unlisted') {
  const response = await fetch(`/api/v1/admin/events/${encodeURIComponent(eventId)}/publish`, {
    body: JSON.stringify({ visibility }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Publication failed with status ${response.status}`);
  return PublicationSummarySchema.parse(await response.json());
}

/** Publication status panel. Publishing never waits for optional facial indexing. */
export function PublishPanel({
  eventId,
  onPublished,
  summary,
  visibility = 'published',
}: PublishPanelProps) {
  const { t } = useTranslation();
  const mutation = useMutation({
    mutationFn: () => publish(eventId, visibility),
    onSuccess: (publishedSummary) => onPublished?.(publishedSummary),
  });
  const readyRatio = summary.totalPhotos === 0 ? 0 : summary.readyPhotos / summary.totalPhotos;
  const published = summary.publishedPhotos === summary.totalPhotos && summary.totalPhotos > 0;

  return (
    <section aria-labelledby="publication-title" className="publish-panel">
      <h2 id="publication-title">{t('publication.title')}</h2>
      <progress
        aria-label={t('publication.variantsReady')}
        max={1}
        value={readyRatio}
      />
      <dl className="publish-panel__status">
        <div>
          <dt>{t('publication.photosSent')}</dt>
          <dd>{summary.totalPhotos}</dd>
        </div>
        <div>
          <dt>{t('publication.variantsReady')}</dt>
          <dd>{summary.readyPhotos}</dd>
        </div>
        <div>
          <dt>{t('publication.galleryPublished')}</dt>
          <dd>{published ? t('publication.published') : t('publication.notPublished')}</dd>
        </div>
        <div>
          <dt>{t('publication.indexing')}</dt>
          <dd>{summary.indexingPhotos}</dd>
        </div>
      </dl>
      {mutation.isError ? <p role="alert">{t('publication.error')}</p> : null}
      <Button
        disabled={summary.readyPhotos !== summary.totalPhotos || summary.totalPhotos === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? t('publication.publishing') : t('publication.publish')}
      </Button>
    </section>
  );
}
