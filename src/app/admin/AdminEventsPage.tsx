import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import { DeleteGalleryResponseSchema, EventSchema } from '../../shared/schemas';
import type { Event } from '../../shared/schemas';
import { BackLink, Button, ConfirmDialog, InfoTooltip, Input, Select, Spinner, Textarea } from '../components';
import { useAdminAccess } from './AdminAccessContext';
import { abandonOriginalImports, getAdminEvents, getCoverPhotos, getOriginalsStatus, requestOriginalsCleanup } from './adminEventsApi';
import { formatMediaStorage } from './formatMediaStorage';
import { PublishPanel } from './PublishPanel';
import { getPublicationSummary } from './publicationApi';

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

function ProtectedListingHint({ access }: { access: Event['access'] }) {
  const { t } = useTranslation();
  return access === 'protected' ? <p className="field__hint">{t('admin.events.protectedListingHint')}</p> : null;
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
  const [allowDownloads, setAllowDownloads] = useState(false);
  const [keepOriginals, setKeepOriginals] = useState(false);
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
      allowDownloads,
      description: typeof values.get('description') === 'string' && values.get('description')
        ? values.get('description')
        : null,
      faceSearchEnabled,
      nearbySearchEnabled,
      showPhotoMetadata: values.get('showPhotoMetadata') === 'on',
      retouchSelectionEnabled: access === 'protected' && values.get('retouchSelectionEnabled') === 'on',
      showOnGalleryPage: values.get('showOnGalleryPage') === 'on',
      keepOriginals: allowDownloads && keepOriginals,
      password: access === 'protected' ? values.get('password') : undefined,
      retentionDays: unlimitedRetention ? null : typeof retention === 'string' && retention ? Number(retention) : null,
      startsAt: galleryDateToIso(startsAt),
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
        setAllowDownloads(false);
        setKeepOriginals(false);
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
        </section>
      ) : null}
      <section aria-labelledby="event-list-title" className="admin-card admin-events__list">
        {readOnly
          ? <h2 className="admin-card__title" id="event-list-title">{t('admin.events.listTitle')}</h2>
          : <h1 className="admin-card__title" id="event-list-title">{t('admin.events.listTitle')}</h1>}
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
                <p>{new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeZone: event.timezone }).format(new Date(event.startsAt))}</p>
                {event.access === 'protected' && event.retouchSelectionCount ? <p className="admin-event-row__favorites">{t('admin.favorites.count', { count: event.retouchSelectionCount })}</p> : null}
              </div>
              <div className="admin-event-row__actions">
                {!event.deletingAt ? <Link className="button button--secondary" to={`/admin/galleries/${event.id}`}>
                  {t(readOnly ? 'admin.demo.inspect' : 'admin.events.settings')}
                </Link> : null}
                {!readOnly && !event.deletingAt ? <Link className="button button--primary" to={`/admin/galleries/${event.id}/import`}>{t('admin.events.import')}</Link> : null}
                {event.access === 'protected' && !event.deletingAt ? <Link className="button button--secondary" to={`/admin/galleries/${event.id}/selections`}>{t('admin.favorites.open')}</Link> : null}
                {event.visibility !== 'draft' && !event.offlineAt && !event.deletingAt ? <Link className="button button--secondary" to={`/e/${event.slug}`}>{t('admin.events.view')}</Link> : null}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section aria-labelledby="event-create-title" className="admin-card">
        <h2 className="admin-card__title" id="event-create-title">{t('admin.events.createTitle')}</h2>
        <p className="admin-card__description">{t('admin.events.createDescription')}</p>
        <form className="admin-event-form" onSubmit={submit}>
          <Input label={t('admin.events.title')} name="title" required />
          <Input label={t('admin.events.date')} name="startsAt" required type="date" />
          <Textarea className="admin-event-form__textarea" label={t('admin.events.description')} maxLength={5000} name="description" />
          <Select label={t('admin.events.access')} onChange={(event) => setAccess(event.target.value as 'protected' | 'public')} value={access}>
              <option value="public">{t('admin.events.public')}</option>
              <option value="protected">{t('admin.events.protected')}</option>
          </Select>
          <ProtectedListingHint access={access} />
          {access === 'protected' ? <Input label={t('admin.events.password')} minLength={8} name="password" required type="password" /> : null}
          <Input disabled={unlimitedRetention} label={t('admin.events.retention')} min={1} name="retentionDays" type="number" />
          <p className="field__hint">{t('admin.events.retentionHint')}</p>
          <label><input checked={unlimitedRetention} onChange={(event) => setUnlimitedRetention(event.target.checked)} type="checkbox" /> {t('admin.events.retentionUnlimited')}</label>
          <fieldset className="admin-event-form__options">
            <legend>{t('admin.events.options')}</legend>
            <div className="admin-event-form__option-with-info"><label><input defaultChecked name="showOnGalleryPage" type="checkbox" /> {t('admin.events.showOnGalleryPage')}</label><InfoTooltip text={t('admin.events.showOnGalleryPageHint')} /></div>
            <label><input checked={allowDownloads} name="allowDownloads" onChange={(changeEvent) => {
              setAllowDownloads(changeEvent.target.checked);
              if (!changeEvent.target.checked) setKeepOriginals(false);
            }} type="checkbox" /> {t('admin.events.allowDownloads')}</label>
            {allowDownloads ? <div className="admin-event-form__option-with-info admin-event-form__option-with-info--dependent"><label><input checked={keepOriginals} name="keepOriginals" onChange={(changeEvent) => setKeepOriginals(changeEvent.target.checked)} type="checkbox" /> {t('admin.events.keepOriginals')}</label><InfoTooltip text={t('admin.events.keepOriginalsHint')} /></div> : null}
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
            {access === 'protected' ? <div className="admin-event-form__option-with-info"><label><input defaultChecked name="retouchSelectionEnabled" type="checkbox" /> {t('admin.events.retouchSelectionEnabled')}</label><InfoTooltip text={t('admin.events.retouchSelectionEnabledHint')} /></div> : null}
          </fieldset>
          {creation.isError ? <p role="alert">{t('admin.events.createError')}</p> : null}
          {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
          <Button disabled={readOnly || creation.isPending} type="submit">{t('admin.events.create')}</Button>
        </form>
      </section>

    </div>
  );
}

function galleryDateValue(isoDate: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit', month: '2-digit', timeZone, year: 'numeric',
  }).formatToParts(new Date(isoDate));
  const value = (part: string) => parts.find((item) => item.type === part)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function galleryDateToIso(date: string): string {
  // Noon avoids a date rollover in zones with midnight DST transitions.
  return new Date(`${date}T12:00:00`).toISOString();
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
      <div className="admin-event-form__option-with-info admin-event-form__option-with-info--dependent">
        <label><input checked={nearbySearchEnabled} disabled={!faceSearchEnabled} name="nearbySearchEnabled" onChange={(event) => onNearbySearchChange(event.target.checked)} type="checkbox" /> {t('admin.events.nearbySearch')}</label>
        <InfoTooltip text={t('admin.events.nearbySearchHint')} />
      </div>
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
  const [allowDownloads, setAllowDownloads] = useState(event.allowDownloads);
  const [keepOriginals, setKeepOriginals] = useState(event.keepOriginals && event.allowDownloads);
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
      allowDownloads,
      description: formString(values, 'description').trim() || null,
      faceSearchEnabled,
      nearbySearchEnabled,
      showPhotoMetadata: values.get('showPhotoMetadata') === 'on',
      retouchSelectionEnabled: access === 'protected' && values.get('retouchSelectionEnabled') === 'on',
      showOnGalleryPage: values.get('showOnGalleryPage') === 'on',
      keepOriginals: allowDownloads && keepOriginals,
      ...(password ? { password } : {}),
      retentionDays: unlimitedRetention ? null : retention ? Number(retention) : null,
      startsAt: galleryDateToIso(startsAt),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || event.timezone,
      title: values.get('title'),
    });
  };

  return (
    <section aria-labelledby="event-settings-title" className="admin-card admin-event-settings">
      <h2 className="admin-card__title" id="event-settings-title">{t('admin.events.settingsSectionTitle')}</h2>
      <form className="admin-event-form" onSubmit={submit}>
        <Input defaultValue={event.title} label={t('admin.events.title')} name="title" required />
        <Input defaultValue={galleryDateValue(event.startsAt, event.timezone)} label={t('admin.events.date')} name="startsAt" required type="date" />
        <Textarea className="admin-event-form__textarea" defaultValue={event.description ?? ''} label={t('admin.events.description')} maxLength={5000} name="description" />
        <Select label={t('admin.events.access')} onChange={(changeEvent) => setAccess(changeEvent.target.value as Event['access'])} value={access}>
            <option value="public">{t('admin.events.public')}</option>
            <option value="protected">{t('admin.events.protected')}</option>
        </Select>
        <ProtectedListingHint access={access} />
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
          <div className="admin-event-form__option-with-info"><label><input defaultChecked={event.showOnGalleryPage} name="showOnGalleryPage" type="checkbox" /> {t('admin.events.showOnGalleryPage')}</label><InfoTooltip text={t('admin.events.showOnGalleryPageHint')} /></div>
          <label><input checked={allowDownloads} name="allowDownloads" onChange={(changeEvent) => {
            setAllowDownloads(changeEvent.target.checked);
            if (!changeEvent.target.checked) setKeepOriginals(false);
          }} type="checkbox" /> {t('admin.events.allowDownloads')}</label>
          {allowDownloads ? <div className="admin-event-form__option-with-info admin-event-form__option-with-info--dependent"><label><input checked={keepOriginals} name="keepOriginals" onChange={(changeEvent) => setKeepOriginals(changeEvent.target.checked)} type="checkbox" /> {t('admin.events.keepOriginals')}</label><InfoTooltip text={t('admin.events.keepOriginalsHint')} /></div> : null}
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
          {access === 'protected' ? <div className="admin-event-form__option-with-info"><label><input defaultChecked={event.retouchSelectionEnabled} name="retouchSelectionEnabled" type="checkbox" /> {t('admin.events.retouchSelectionEnabled')}</label><InfoTooltip text={t('admin.events.retouchSelectionEnabledHint')} /></div> : null}
        </fieldset>
        {update.isError ? <p role="alert">{t('admin.events.updateError')}</p> : null}
        {saved ? <p role="status">{t('admin.events.updated')}</p> : null}
        {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
        <Button disabled={readOnly || update.isPending} type="submit">{t('admin.events.save')}</Button>
      </form>
    </section>
  );
}

function OriginalsCleanupPanel({ event }: { event: Event }) {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const status = useQuery({
    queryKey: ['admin-originals', event.id],
    queryFn: () => getOriginalsStatus(event.id),
    refetchInterval: (query) => query.state.data?.cleanupState === 'pending' || query.state.data?.cleanupState === 'running' ? 5_000 : false,
  });
  const cleanup = useMutation({
    mutationFn: () => requestOriginalsCleanup(event.id),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-originals', event.id] });
    },
  });
  const abandon = useMutation({
    mutationFn: () => abandonOriginalImports(event.id),
    onSuccess: async () => {
      setAbandonOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['admin-originals', event.id] });
    },
  });
  if (event.allowDownloads && event.keepOriginals) return null;
  if (status.isPending) return null;
  if (status.isError) return <section className="admin-card admin-originals-warning"><p role="alert">{t('admin.events.originalsStatusError')}</p></section>;
  if (!status.data || (status.data.count === 0 && status.data.activeImports === 0)) return null;
  const value = formatMediaStorage(status.data.bytes, i18n.language);
  const busy = status.data.cleanupState === 'pending' || status.data.cleanupState === 'running';
  return <section aria-labelledby="original-cleanup-title" className="admin-card admin-originals-warning">
    <h2 className="admin-card__title" id="original-cleanup-title">{t(status.data.count > 0 ? 'admin.events.originalsWarningTitle' : 'admin.events.originalsImportTitle')}</h2>
    {status.data.count > 0 ? <p>{t('admin.events.originalsWarningBody', { count: status.data.count, amount: value.amount, unit: t(`admin.settings.storageUnits.${value.unit}`) })}</p> : null}
    {busy ? <p role="status">{t('admin.events.originalsCleanupPending')}</p> : null}
    {status.data.activeImports > 0 ? <>
      <p>{t('admin.events.originalsImportsPending')}</p>
      <Button disabled={readOnly || busy} onClick={() => setAbandonOpen(true)} type="button" variant="secondary">{t('admin.events.originalsAbandonImports')}</Button>
    </> : null}
    {status.data.cleanupState === 'failed' ? <p role="alert">{t('admin.events.originalsCleanupFailed')}</p> : null}
    {status.data.count > 0 ? <Button disabled={readOnly || busy || status.data.activeImports > 0} onClick={() => setOpen(true)} type="button" variant="danger">{t('admin.events.originalsDelete')}</Button> : null}
    <ConfirmDialog
      cancelLabel={t('admin.events.originalsCancel')}
      closeLabel={t('admin.events.originalsCancel')}
      confirmLabel={t('admin.events.originalsDeleteConfirm')}
      isConfirming={cleanup.isPending}
      onCancel={() => { if (!cleanup.isPending) setOpen(false); }}
      onConfirm={() => cleanup.mutate()}
      open={open}
      title={t('admin.events.originalsDialogTitle')}
    >
      <p>{t('admin.events.originalsDialogBody')}</p>
      {cleanup.isError ? <p role="alert">{t('admin.events.originalsCleanupError')}</p> : null}
    </ConfirmDialog>
    <ConfirmDialog
      cancelLabel={t('admin.events.originalsCancel')}
      closeLabel={t('admin.events.originalsCancel')}
      confirmLabel={t('admin.events.originalsAbandonConfirm')}
      isConfirming={abandon.isPending}
      onCancel={() => { if (!abandon.isPending) setAbandonOpen(false); }}
      onConfirm={() => abandon.mutate()}
      open={abandonOpen}
      title={t('admin.events.originalsAbandonTitle')}
    >
      <p>{t('admin.events.originalsAbandonBody')}</p>
      {abandon.isError ? <p role="alert">{t('admin.events.originalsCleanupError')}</p> : null}
    </ConfirmDialog>
  </section>;
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

function CoverPhotoPanel({ event }: { event: Event }) {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(event.coverPhotoId);
  const candidates = useInfiniteQuery({
    queryKey: ['admin-cover-photos', event.id],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => getCoverPhotos(event.id, pageParam),
    getNextPageParam: (page) => page.nextOffset ?? undefined,
  });
  const update = useMutation({
    mutationFn: (coverPhotoId: string | null) => updateEvent(event.id, { coverPhotoId }),
    onSuccess: async (updated) => {
      setSelectedId(updated.coverPhotoId);
      await queryClient.invalidateQueries({ queryKey: ['admin-events'] });
    },
  });
  const photos = candidates.data?.pages.flatMap((page) => page.photos) ?? [];
  const select = (id: string | null) => {
    if (readOnly) setSelectedId(id);
    else update.mutate(id);
  };
  return (
    <section aria-labelledby="gallery-cover-title" className="admin-card admin-cover">
      <h2 className="admin-card__title" id="gallery-cover-title">{t('admin.events.coverTitle')}</h2>
      <p className="admin-card__description">{t('admin.events.coverDescription')}</p>
      {selectedId ? <div className="admin-cover__current">
        <img alt="" src={`/api/v1/admin/galleries/${encodeURIComponent(event.id)}/cover-photos/${encodeURIComponent(selectedId)}`} />
        <span>{t('admin.events.coverCurrent')}</span>
      </div> : null}
      {candidates.isPending ? <Spinner label={t('admin.events.coverLoading')} /> : null}
      {candidates.isError ? <p role="alert">{t('admin.events.coverError')}</p> : null}
      {!candidates.isPending && photos.length === 0 ? <p>{t('admin.events.coverEmpty')}</p> : null}
      <div className="admin-cover__grid">
        {photos.map((photo) => (
          <button
            aria-label={t('admin.events.coverChoose', { filename: photo.filename })}
            aria-pressed={selectedId === photo.id}
            className="admin-cover__choice"
            disabled={update.isPending}
            key={photo.id}
            onClick={() => select(photo.id)}
            type="button"
          >
            <img alt="" loading="lazy" src={photo.thumbnailUrl} />
            <span>{photo.filename}</span>
          </button>
        ))}
      </div>
      {candidates.hasNextPage ? <Button disabled={candidates.isFetchingNextPage} onClick={() => void candidates.fetchNextPage()} type="button" variant="secondary">{t('admin.events.coverMore')}</Button> : null}
      {selectedId ? <Button disabled={update.isPending} onClick={() => select(null)} type="button" variant="secondary">{t('admin.events.coverClear')}</Button> : null}
      {update.isError ? <p role="alert">{t('admin.events.coverSaveError')}</p> : null}
      {readOnly ? <p className="admin-card__description">{t('admin.demo.formPlayground')}</p> : null}
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
      <header className="admin-workspace__heading">
        <BackLink to="/admin">{t('admin.events.back')}</BackLink>
        <h1>{t('admin.events.settingsTitle', { title: event.title })}</h1>
      </header>
      <PublishPanel
        eventId={eventId}
        onChanged={(updated) => {
          queryClient.setQueryData(['publication-summary', eventId], updated);
          void queryClient.invalidateQueries({ queryKey: ['admin-events'] });
        }}
        readOnly={readOnly}
        summary={publication.data}
      />
      <AdminEventSettingsForm event={event} key={event.updatedAt} />
      {event.access === 'protected' ? <section className="admin-card"><h2 className="admin-card__title">{t('admin.favorites.sectionTitle')}</h2><p className="admin-card__description">{t('admin.favorites.sectionDescription')}</p><Link className="button button--secondary" to={`/admin/galleries/${event.id}/selections`}>{t('admin.favorites.open')}</Link></section> : null}
      <OriginalsCleanupPanel event={event} />
      <CoverPhotoPanel event={event} key={`cover-${event.updatedAt}`} />
      <DeleteGalleryPanel event={event} />
    </div>
  );
}
