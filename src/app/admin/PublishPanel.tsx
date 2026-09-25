import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { PublicationState, PublicationSummary } from '../../shared/schemas';
import { Badge, Button, ConfirmDialog, Select } from '../components';
import { i18n } from '../i18n';
import { updatePublication } from './publicationApi';
import { installPublicationResources } from './publicationResources';
import './publish-panel.css';

installPublicationResources(i18n);

export interface PublishPanelProps {
  eventId: string;
  onChanged?: (summary: PublicationSummary) => void;
  readOnly?: boolean;
  showSettingsLink?: boolean;
  summary: PublicationSummary;
}

function currentState(summary: PublicationSummary): PublicationState | 'draft' {
  return summary.offlineAt ? 'offline' : summary.visibility;
}

function defaultTarget(summary: PublicationSummary): PublicationState {
  return summary.visibility === 'unlisted' ? 'unlisted' : 'published';
}

/** Shared reversible availability control used by gallery settings and import workflows. */
export function PublishPanel({ eventId, onChanged, readOnly = false, showSettingsLink = false, summary }: PublishPanelProps) {
  const { t } = useTranslation();
  const state = currentState(summary);
  const [target, setTarget] = useState<PublicationState>(() => defaultTarget(summary));
  const [confirmingOffline, setConfirmingOffline] = useState(false);
  const mutation = useMutation({
    mutationFn: (nextState: PublicationState) => updatePublication(eventId, nextState),
    onSuccess: (updated) => {
      setConfirmingOffline(false);
      setTarget(defaultTarget(updated));
      onChanged?.(updated);
    },
  });

  const ready = summary.totalPhotos > 0 && summary.readyPhotos === summary.totalPhotos;
  const unchanged = target === state;
  const invalidOfflineDraft = target === 'offline' && state === 'draft';
  const disabled = readOnly || mutation.isPending || unchanged || invalidOfflineDraft || (target !== 'offline' && !ready);
  const actionKey = target === 'offline'
    ? 'publication.takeOffline'
    : state === 'offline'
      ? 'publication.republish'
      : state === 'draft'
        ? 'publication.publish'
        : 'publication.saveAvailability';
  const badgeVariant = state === 'published' ? 'success' : state === 'unlisted' ? 'warning' : state === 'offline' ? 'danger' : 'neutral';

  const apply = () => {
    if (target === 'offline' && state !== 'offline') {
      setConfirmingOffline(true);
      return;
    }
    mutation.mutate(target);
  };

  return (
    <section aria-labelledby="publication-title" className="publish-panel">
      <div className="publish-panel__heading">
        <div>
          <h2 id="publication-title">{t('publication.title')}</h2>
          <p>{t('publication.description')}</p>
        </div>
        <Badge variant={badgeVariant}>{t(`publication.state.${state}`)}</Badge>
      </div>
      <progress aria-label={t('publication.variantsReady')} max={1} value={summary.totalPhotos === 0 ? 0 : summary.readyPhotos / summary.totalPhotos} />
      <dl className="publish-panel__status">
        <div><dt>{t('publication.photosSent')}</dt><dd>{summary.totalPhotos}</dd></div>
        <div><dt>{t('publication.variantsReady')}</dt><dd>{summary.readyPhotos}</dd></div>
        <div><dt>{t('publication.indexing')}</dt><dd>{summary.indexingPhotos}</dd></div>
      </dl>
      <Select
        hint={t(`publication.targetHint.${target}`)}
        label={t('publication.availability')}
        onChange={(event) => setTarget(event.target.value as PublicationState)}
        value={target}
      >
        <option value="published">{t('publication.target.published')}</option>
        <option value="unlisted">{t('publication.target.unlisted')}</option>
        <option disabled={state === 'draft'} value="offline">{t('publication.target.offline')}</option>
      </Select>
      {readOnly ? <p className="publish-panel__note">{t('publication.readOnly')}</p> : null}
      {mutation.isError ? <p role="alert">{t('publication.error')}</p> : null}
      <div className="publish-panel__actions">
        <Button disabled={disabled} onClick={apply} variant={target === 'offline' ? 'danger' : 'primary'}>
          {mutation.isPending ? t('publication.saving') : t(actionKey)}
        </Button>
        {showSettingsLink ? <Link className="button button--secondary" to={`/admin/galleries/${encodeURIComponent(eventId)}`}>
          {t('publication.gallerySettings')}
        </Link> : null}
      </div>
      <ConfirmDialog
        cancelLabel={t('publication.cancel')}
        closeLabel={t('publication.close')}
        confirmLabel={t('publication.confirmOffline')}
        isConfirming={mutation.isPending}
        onCancel={() => setConfirmingOffline(false)}
        onConfirm={() => mutation.mutate('offline')}
        open={confirmingOffline}
        title={t('publication.offlineTitle')}
      >
        <p>{t('publication.offlineBody')}</p>
      </ConfirmDialog>
    </section>
  );
}
