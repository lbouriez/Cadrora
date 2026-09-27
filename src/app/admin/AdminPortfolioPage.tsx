import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { createImageEncoder } from '../../browser/images';
import { DeletePortfolioItemResponseSchema, PortfolioItemSchema, PortfolioItemsSchema, ServiceCardsSchema, ServiceImageUploadResponseSchema } from '../../shared/schemas';
import type { PortfolioItem, ServiceCard } from '../../shared/schemas';
import { Button, ConfirmDialog, Input, Select, Spinner } from '../components';
import { serviceText } from '../public/serviceCatalog';
import { useAdminAccess } from './AdminAccessContext';

async function apiJson<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Portfolio request returned ${response.status}`);
  return schema.parse(await response.json());
}

async function uploadPhoto(id: string, file: File): Promise<void> {
  const encoder = createImageEncoder();
  try {
    const encoded = await encoder.encodeService(file);
    for (const variant of encoded.variants) {
      await apiJson(`/api/v1/admin/portfolio/${id}/image/${variant.name}`, ServiceImageUploadResponseSchema, {
        method: 'PUT', body: variant.blob, headers: {
          'Content-Type': variant.contentType,
          'X-Cadrora-Byte-Size': String(variant.byteSize),
          'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
          'X-Cadrora-Height': String(variant.height),
          'X-Cadrora-Width': String(variant.width),
        },
      });
    }
    await apiJson(`/api/v1/admin/portfolio/${id}/publish`, PortfolioItemSchema, { method: 'POST' });
  } finally { encoder.dispose(); }
}

function PortfolioItemEditor({ item, services, onChanged }: { item: PortfolioItem; services: ServiceCard[]; onChanged: () => Promise<void> }) {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const [serviceId, setServiceId] = useState(item.serviceId);
  const [altFr, setAltFr] = useState(item.alt.fr);
  const [altEn, setAltEn] = useState(item.alt.en);
  const [sortOrder, setSortOrder] = useState(item.sortOrder);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    if (readOnly || busy || !altFr.trim() || !altEn.trim()) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      await apiJson(`/api/v1/admin/portfolio/${item.id}`, PortfolioItemSchema, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, alt: { fr: altFr.trim(), en: altEn.trim() }, sortOrder }),
      });
      await onChanged(); setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || readOnly) return;
    setBusy(true); setError(false);
    try { await uploadPhoto(item.id, file); await onChanged(); }
    catch { setError(true); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (readOnly || busy) return;
    setBusy(true); setError(false);
    try {
      await apiJson(`/api/v1/admin/portfolio/${item.id}`, DeletePortfolioItemResponseSchema, { method: 'DELETE' });
      await onChanged();
    } catch { setError(true); } finally { setBusy(false); setConfirmDelete(false); }
  };
  const preview = item.imageSources.find((source) => source.url.endsWith('/small')) ?? item.imageSources[0];
  return <article className="admin-portfolio-item">
    {preview ? <img alt={item.alt[language]} src={item.state === 'published' ? preview.url
      : `/api/v1/admin/portfolio/${item.id}/image/${preview.url.split('/').at(-1)}`} /> : null}
    <div className="admin-portfolio-item__fields">
      <p>{t(item.state === 'published' ? 'admin.portfolio.published' : 'admin.portfolio.pending')}</p>
      <Select label={t('admin.portfolio.service')} onChange={(event) => setServiceId(event.target.value)} value={serviceId}>
        {services.map((service) => <option key={service.id} value={service.id}>{serviceText(service, language, (key) => t(key)).title}</option>)}
      </Select>
      <Input label={t('admin.portfolio.altFr')} maxLength={200} onChange={(event) => setAltFr(event.target.value)} required value={altFr} />
      <Input label={t('admin.portfolio.altEn')} maxLength={200} onChange={(event) => setAltEn(event.target.value)} required value={altEn} />
      <Input label={t('admin.portfolio.order')} min="0" onChange={(event) => setSortOrder(Number(event.target.value))} required type="number" value={sortOrder} />
      {item.state === 'pending' ? <label className="field"><span className="field__label">{t('admin.portfolio.upload')}</span>
        <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly} onChange={(event) => { void upload(event); }} type="file" />
        <span className="field__hint">{t('admin.portfolio.uploadHint')}</span>
      </label> : null}
      <div className="admin-portfolio-item__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{t('admin.portfolio.save')}</Button>
        <Button disabled={busy || readOnly} onClick={() => setConfirmDelete(true)} variant="danger">{t('admin.portfolio.remove')}</Button>
      </div>
      {error ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
      {saved ? <p role="status">{t('admin.portfolio.saved')}</p> : null}
    </div>
    <ConfirmDialog cancelLabel={t('admin.portfolio.cancel')} closeLabel={t('admin.portfolio.cancel')}
      confirmLabel={t('admin.portfolio.remove')} isConfirming={busy} onCancel={() => setConfirmDelete(false)}
      onConfirm={() => { void remove(); }} open={confirmDelete} title={t('admin.portfolio.removeTitle')}>
      <p>{t('admin.portfolio.removeBody')}</p>
    </ConfirmDialog>
  </article>;
}

export function AdminPortfolioPage() {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const client = useQueryClient();
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const services = useQuery({ queryFn: () => apiJson('/api/v1/admin/services', ServiceCardsSchema), queryKey: ['admin-services'] });
  const items = useQuery({ queryFn: () => apiJson('/api/v1/admin/portfolio', PortfolioItemsSchema), queryKey: ['admin-portfolio'] });
  const [serviceId, setServiceId] = useState('');
  const [altFr, setAltFr] = useState('');
  const [altEn, setAltEn] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const refresh = async () => { await Promise.all([
    client.invalidateQueries({ queryKey: ['admin-portfolio'] }), client.invalidateQueries({ queryKey: ['public-portfolio'] }),
  ]); };
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly || busy) return;
    const file = new FormData(event.currentTarget).get('photo');
    const chosenService = serviceId || services.data?.[0]?.id;
    if (!(file instanceof File) || !file.size || !chosenService || !altFr.trim() || !altEn.trim()) { setError(true); return; }
    setBusy(true); setError(false);
    try {
      const created = await apiJson('/api/v1/admin/portfolio', PortfolioItemSchema, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: chosenService, alt: { fr: altFr.trim(), en: altEn.trim() } }),
      });
      await uploadPhoto(created.id, file);
      setAltFr(''); setAltEn('');
      await refresh();
    } catch { setError(true); await refresh(); } finally { setBusy(false); }
  };
  if (services.isPending || items.isPending) return <Spinner label={t('admin.portfolio.loading')} />;
  if (services.isError || items.isError || !services.data || !items.data) return <p role="alert">{t('admin.portfolio.error')}</p>;
  return <div className="admin-workspace">
    <section className="admin-card">
      <h1 className="admin-card__title">{t('admin.portfolio.title')}</h1>
      <p className="admin-card__description">{t('admin.portfolio.description')}</p>
      <form className="admin-event-form" onSubmit={(event) => { void submit(event); }}>
        <Select label={t('admin.portfolio.service')} onChange={(event) => setServiceId(event.target.value)} value={serviceId || services.data[0]?.id || ''}>
          {services.data.map((service) => <option key={service.id} value={service.id}>{serviceText(service, language, (key) => t(key)).title}</option>)}
        </Select>
        <Input label={t('admin.portfolio.altFr')} maxLength={200} onChange={(event) => setAltFr(event.target.value)} required value={altFr} />
        <Input label={t('admin.portfolio.altEn')} maxLength={200} onChange={(event) => setAltEn(event.target.value)} required value={altEn} />
        <label className="field"><span className="field__label">{t('admin.portfolio.photo')}</span>
          <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly} name="photo" required type="file" />
        </label>
        <Button disabled={busy || readOnly || !services.data.length} type="submit">{t('admin.portfolio.add')}</Button>
        {error ? <p role="alert">{t('admin.portfolio.error')}</p> : null}
      </form>
    </section>
    <section className="admin-card">
      <h2 className="admin-card__title">{t('admin.portfolio.photos')}</h2>
      {!items.data.length ? <p>{t('admin.portfolio.empty')}</p> : null}
      <div className="admin-portfolio-list">{items.data.map((item) => <PortfolioItemEditor item={item} key={item.id}
        onChanged={refresh} services={services.data} />)}</div>
    </section>
  </div>;
}
