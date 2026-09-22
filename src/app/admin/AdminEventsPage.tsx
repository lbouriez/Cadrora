import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { AdminEventListSchema, DeleteGalleryResponseSchema, EventSchema } from '../../shared/schemas';
import type { Event } from '../../shared/schemas';
import { Button, ConfirmDialog, Input, Select, Spinner, Textarea } from '../components';
import { useAdminAccess } from './AdminAccessContext';
import { PublishPanel } from './PublishPanel';
import { getPublicationSummary } from './publicationApi';

async function getAdminEvents(): Promise<Event[]> {
  const response = await fetch('/api/v1/admin/galleries', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Event list returned ${response.status}`);
  return AdminEventListSchema.parse(await response.json()).events;
}

async function createEvent(payload: unknown): Promise<Event> {
  const response = await fetch('/api/v1/admin/galleries', {
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw new Error(`Event creation returned ${response.status}`);
  return EventSchema.parse(await response.json());
}

async function updateEvent(eventId: string, payload: unknown): Promise<Event> {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}`, {
    body: JSON.stringify(payload),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(`Event update returned ${response.status}`);
  return EventSchema.parse(await response.json());
}

async function deleteGallery(eventId: string, confirmation: string): Promise<void> {
  const response = await fetch(`/api/v1/admin/galleries/${encodeURIComponent(eventId)}`, {
    body: JSON.stringify({ confirmation }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'DELETE',
  });
  if (!response.ok) throw new Error(`Gallery deletion returned ${response.status}`);
  DeleteGalleryResponseSchema.parse(await response.json());
}

export function AdminEventsPage() {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const [access, setAccess] = useState<'protected' | 'public'>('public');
  const [unlimitedRetention, setUnlimitedRetention] = useState(true);
  const [faceSearchEnabled, setFaceSearchEnabled] = useState(false);
  const [nearbySearchEnabled, setNearbySearchEnabled] = useState(false);
  const events = useQuery({ queryFn: getAdminEvents, queryKey: ['admin-events'] });
  const creation = useMutation({
    mutationFn: createEvent,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });

  const submit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (readOnly) return;
    const form = submitEvent.currentTarget;
    const values = new FormData(form);
    const startsAt = values.get('startsAt');
    const retention = values.get('retentionDays');
    if (typeof startsAt !== 'string') return;
    creation.mutate({
      access,
      allowDownloads: values.get('allowDownloads') === 'on',
      description: typeof values.get('description') === 'string' && values.get('description')
        ? values.get('description')
        : null,
      faceSearchEnabled,
      nearbySearchEnabled,
      showPhotoMetadata: values.get('showPhotoMetadata') === 'on',
      keepOriginals: values.get('keepOriginals') === 'on',
      password: access === 'protected' ? values.get('password') : undefined,
      retentionDays: unlimitedRetention ? null : typeof retention === 'string' && retention ? Number(retention) : null,
      startsAt: new Date(startsAt).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      title: values.get('title'),
      visibility: 'draft',
    }, {
      onSuccess: () => {
        form.reset();
        setAccess('public');
        setUnlimitedRetention(true);
        setFaceSearchEnabled(false);
        setNearbySearchEnabled(false);
      },
    });
  };

  return (
    <div className="admin-events">
      {readOnly ? (
        <section className="admin-card admin-demo-intro" aria-labelledby="admin-demo-title">
          <p className="admin-demo-intro__eyebrow">{t('admin.demo.eyebrow')}</p>
          <h1 className="admin-card__title" id="admin-demo-title">{t('admin.demo.dashboardTitle')}</h1>
          <p className="admin-card__description">{t('admin.demo.dashboardBody')}</p>
          <section aria-labelledby="admin-demo-capabilities-title" className="admin-demo-capabilities">
            <h2 className="admin-card__title" id="admin-demo-capabilities-title">{t('admin.demo.capabilitiesTitle')}</h2>
            <p className="admin-card__description">{t('admin.demo.capabilitiesBody')}</p>
            <div className="admin-demo-capabilities__actions">
              <Button disabled type="button">{t('admin.demo.createGallery')}</Button>
              <Button disabled type="button" variant="secondary">{t('admin.demo.importPhotos')}</Button>
              <Button disabled type="button" variant="secondary">{t('admin.demo.publishGallery')}</Button>
            </div>
          </section>
        </section>
      ) : null}
      <section aria-labelledby="event-create-title" className="admin-card">
        <h1 className="admin-card__title" id="event-create-title">{t('admin.events.createTitle')}</h1>
        <p className="admin-card__description">{t('admin.events.createDescription')}</p>
        <form className="admin-event-form" onSubmit={submit}>
          <Input label={t('admin.events.title')} name="title" required />
          <Input label={t('admin.events.date')} name="startsAt" required type="datetime-local" />
          <Textarea className="admin-event-form__textarea" label={t('admin.events.description')} maxLength={5000} name="description" />
          <Select label={t('admin.events.access')} onChange={(event) => setAccess(event.target.value as 'protected' | 'public')} value={access}>
              <option value="public">{t('admin.events.public')}</option>
              <option value="protected">{t('admin.events.protected')}</option>
          </Select>
          {access === 'protected' ? <Input label={t('admin.events.password')} minLength={8} name="password" required type="password" /> : null}
          <Input disabled={unlimitedRetention} label={t('admin.events.retention')} min={1} name="retentionDays" type="number" />
          <p className="field__hint">{t('admin.events.retentionHint')}</p>
          <label><input checked={unlimitedRetention} onChange={(event) => setUnlimitedRetention(event.target.checked)} type="checkbox" /> {t('admin.events.retentionUnlimited')}</label>
          <fieldset className="admin-event-form__options">
            <legend>{t('admin.events.options')}</legend>
            <label><input name="allowDownloads" type="checkbox" /> {t('admin.events.allowDownloads')}</label>
            <FaceSearchOptions
              faceSearchEnabled={faceSearchEnabled}
              nearbySearchEnabled={nearbySearchEnabled}
              onFaceSearchChange={(enabled) => {
                setFaceSearchEnabled(enabled);
                if (!enabled) setNearbySearchEnabled(false);
              }}
              onNearbySearchChange={setNearbySearchEnabled}
            />
            <label><input name="showPhotoMetadata" type="checkbox" /> {t('admin.events.showPhotoMetadata')}</label>
            <label><input name="keepOriginals" type="checkbox" /> {t('admin.events.keepOriginals')}</label>
          </fieldset>
          {creation.isError ? <p role="alert">{t('admin.events.createError')}</p> : null}
          {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
          <Button disabled={readOnly || creation.isPending} type="submit">{t('admin.events.create')}</Button>
        </form>
      </section>

      <section aria-labelledby="event-list-title" className="admin-card">
        <h2 className="admin-card__title" id="event-list-title">{t('admin.events.listTitle')}</h2>
        {events.isPending ? <Spinner label={t('admin.events.loading')} /> : null}
        {events.isError ? <p role="alert">{t('admin.events.listError')}</p> : null}
        {events.data?.length === 0 ? <p>{t('admin.events.empty')}</p> : null}
        <div className="admin-event-list">
          {events.data?.map((event) => (
            <article className="admin-event-row" key={event.id}>
              <div>
                <span className="admin-event-row__state">{event.deletingAt
                  ? t('admin.events.deletionPending')
                  : t(`admin.events.visibility.${event.offlineAt ? 'offline' : event.visibility}`)}</span>
                <h3>{event.title}</h3>
                <p>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(event.startsAt))}</p>
              </div>
              <div className="admin-event-row__actions">
                {!event.deletingAt ? <Link className="button button--secondary" to={`/admin/galleries/${event.id}`}>
                  {t(readOnly ? 'admin.demo.inspect' : 'admin.events.settings')}
                </Link> : null}
                {!readOnly && !event.deletingAt ? <Link className="button button--primary" to={`/admin/galleries/${event.id}/import`}>{t('admin.events.import')}</Link> : null}
                {event.visibility !== 'draft' && !event.offlineAt && !event.deletingAt ? <Link className="button button--secondary" to={`/e/${event.slug}`}>{t('admin.events.view')}</Link> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function localDateTimeValue(isoDate: string): string {
  const date = new Date(isoDate);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formString(values: FormData, name: string): string {
  const value = values.get(name);
  return typeof value === 'string' ? value : '';
}

interface FaceSearchOptionsProps {
  faceSearchEnabled: boolean;
  nearbySearchEnabled: boolean;
  onFaceSearchChange: (enabled: boolean) => void;
  onNearbySearchChange: (enabled: boolean) => void;
}

function FaceSearchOptions({
  faceSearchEnabled,
  nearbySearchEnabled,
  onFaceSearchChange,
  onNearbySearchChange,
}: FaceSearchOptionsProps) {
  const { t } = useTranslation();
  return (
    <>
      <label>
        <input checked={faceSearchEnabled} name="faceSearchEnabled" onChange={(event) => onFaceSearchChange(event.target.checked)} type="checkbox" /> {t('admin.events.faceSearch')}
      </label>
      <label className="admin-event-form__dependent-option">
        <input checked={nearbySearchEnabled} disabled={!faceSearchEnabled} name="nearbySearchEnabled" onChange={(event) => onNearbySearchChange(event.target.checked)} type="checkbox" /> {t('admin.events.nearbySearch')}
        <span>{t('admin.events.nearbySearchHint')}</span>
      </label>
    </>
  );
}

function AdminEventSettingsForm({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const [access, setAccess] = useState(event.access);
  const [unlimitedRetention, setUnlimitedRetention] = useState(event.retentionDays === null);
  const [faceSearchEnabled, setFaceSearchEnabled] = useState(event.faceSearchEnabled);
  const [nearbySearchEnabled, setNearbySearchEnabled] = useState(event.nearbySearchEnabled);
  const [saved, setSaved] = useState(false);
  const update = useMutation({
    mutationFn: (payload: unknown) => updateEvent(event.id, payload),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });

  const submit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    if (readOnly) return;
    setSaved(false);
    const values = new FormData(submitEvent.currentTarget);
    const startsAt = formString(values, 'startsAt');
    const retention = formString(values, 'retentionDays');
    const password = formString(values, 'password');
    update.mutate({
      access,
      allowDownloads: values.get('allowDownloads') === 'on',
      description: formString(values, 'description').trim() || null,
      faceSearchEnabled,
      nearbySearchEnabled,
      showPhotoMetadata: values.get('showPhotoMetadata') === 'on',
      keepOriginals: values.get('keepOriginals') === 'on',
      ...(password ? { password } : {}),
      retentionDays: unlimitedRetention ? null : retention ? Number(retention) : null,
      startsAt: new Date(startsAt).toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || event.timezone,
      title: values.get('title'),
    });
  };

  return (
    <section aria-labelledby="event-settings-title" className="admin-card admin-event-settings">
      <p><Link to="/admin">← {t('admin.events.back')}</Link></p>
      <h1 className="admin-card__title" id="event-settings-title">{t('admin.events.settingsTitle', { title: event.title })}</h1>
      <form className="admin-event-form" onSubmit={submit}>
        <Input defaultValue={event.title} label={t('admin.events.title')} name="title" required />
        <Input defaultValue={localDateTimeValue(event.startsAt)} label={t('admin.events.date')} name="startsAt" required type="datetime-local" />
        <Textarea className="admin-event-form__textarea" defaultValue={event.description ?? ''} label={t('admin.events.description')} maxLength={5000} name="description" />
        <Select label={t('admin.events.access')} onChange={(changeEvent) => setAccess(changeEvent.target.value as Event['access'])} value={access}>
            <option value="public">{t('admin.events.public')}</option>
            <option value="protected">{t('admin.events.protected')}</option>
        </Select>
        {access === 'protected' ? (
          <Input
            label={event.access === 'protected' ? t('admin.events.newPassword') : t('admin.events.password')}
            minLength={8}
            name="password"
            required={event.access !== 'protected'}
            type="password"
          />
        ) : null}
        <Input defaultValue={event.retentionDays ?? ''} disabled={unlimitedRetention} label={t('admin.events.retention')} min={1} name="retentionDays" type="number" />
        <p className="field__hint">{t('admin.events.retentionHint')}</p>
        <label><input checked={unlimitedRetention} onChange={(changeEvent) => setUnlimitedRetention(changeEvent.target.checked)} type="checkbox" /> {t('admin.events.retentionUnlimited')}</label>
        <fieldset className="admin-event-form__options">
          <legend>{t('admin.events.options')}</legend>
          <label><input defaultChecked={event.allowDownloads} name="allowDownloads" type="checkbox" /> {t('admin.events.allowDownloads')}</label>
          <FaceSearchOptions
            faceSearchEnabled={faceSearchEnabled}
            nearbySearchEnabled={nearbySearchEnabled}
            onFaceSearchChange={(enabled) => {
              setFaceSearchEnabled(enabled);
              if (!enabled) setNearbySearchEnabled(false);
            }}
            onNearbySearchChange={setNearbySearchEnabled}
          />
          <label><input defaultChecked={event.showPhotoMetadata} name="showPhotoMetadata" type="checkbox" /> {t('admin.events.showPhotoMetadata')}</label>
          <label><input defaultChecked={event.keepOriginals} name="keepOriginals" type="checkbox" /> {t('admin.events.keepOriginals')}</label>
        </fieldset>
        {update.isError ? <p role="alert">{t('admin.events.updateError')}</p> : null}
        {saved ? <p role="status">{t('admin.events.updated')}</p> : null}
        {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
        <Button disabled={readOnly || update.isPending} type="submit">{t('admin.events.save')}</Button>
      </form>
    </section>
  );
}

function DeleteGalleryPanel({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const deletion = useMutation({
    mutationFn: () => deleteGallery(event.id, confirmation),
    onSuccess: () => { void navigate('/admin', { replace: true }); },
  });
  const close = () => {
    if (deletion.isPending) return;
    setOpen(false);
    setConfirmation('');
  };
  return (
    <section aria-labelledby="delete-gallery-title" className="admin-card admin-danger-zone">
      <p className="admin-demo-intro__eyebrow">{t('admin.events.dangerEyebrow')}</p>
      <h2 className="admin-card__title" id="delete-gallery-title">{t('admin.events.deleteTitle')}</h2>
      <p className="admin-card__description">{t('admin.events.deleteDescription')}</p>
      {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
      <Button disabled={readOnly || Boolean(event.deletingAt)} onClick={() => setOpen(true)} type="button" variant="danger">
        {event.deletingAt ? t('admin.events.deletionPending') : t('admin.events.delete')}
      </Button>
      <ConfirmDialog
        cancelLabel={t('admin.events.deleteCancel')}
        closeLabel={t('admin.events.deleteCancel')}
        confirmDisabled={confirmation !== event.title}
        confirmLabel={deletion.isPending ? t('admin.events.deleting') : t('admin.events.deleteConfirm')}
        isConfirming={deletion.isPending}
        onCancel={close}
        onConfirm={() => deletion.mutate()}
        open={open}
        title={t('admin.events.deleteDialogTitle')}
      >
        <p>{t('admin.events.deleteDialogBody')}</p>
        <p><strong>{event.title}</strong></p>
        <Input
          autoComplete="off"
          {...(deletion.isError ? { error: t('admin.events.deleteError') } : {})}
          label={t('admin.events.deleteConfirmationLabel')}
          onChange={(changeEvent) => setConfirmation(changeEvent.target.value)}
          value={confirmation}
        />
      </ConfirmDialog>
    </section>
  );
}

export function AdminEventSettingsPage({ eventId }: { eventId: string }) {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const events = useQuery({ queryFn: getAdminEvents, queryKey: ['admin-events'] });
  const publication = useQuery({ queryFn: () => getPublicationSummary(eventId), queryKey: ['publication-summary', eventId] });
  if (events.isPending || publication.isPending) return <Spinner label={t('admin.events.loading')} />;
  const event = events.data?.find((candidate) => candidate.id === eventId);
  if (events.isError || publication.isError || !event || !publication.data) return <p role="alert">{t('admin.events.notFound')}</p>;
  return (
    <div className="admin-workspace">
      <div className="admin-settings-stack">
        <AdminEventSettingsForm event={event} key={event.updatedAt} />
        <DeleteGalleryPanel event={event} />
      </div>
      <PublishPanel
        eventId={eventId}
        onChanged={(updated) => {
          queryClient.setQueryData(['publication-summary', eventId], updated);
          void queryClient.invalidateQueries({ queryKey: ['admin-events'] });
        }}
        readOnly={readOnly}
        summary={publication.data}
      />
    </div>
  );
}
