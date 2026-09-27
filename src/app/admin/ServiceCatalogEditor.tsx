import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LanguageSchema, ServiceCardSchema, ServiceCardsSchema, ServiceCopySchema,
  ServiceImageRevisionSchema, ServiceImageUploadResponseSchema,
} from '../../shared/schemas';
import type { Language, ServiceCard, ServiceCopy } from '../../shared/schemas';
import { createImageEncoder } from '../../browser/images';
import { Button, Spinner } from '../components';
import { ServicePhoto } from '../public/ServicePhoto';
import { LocalizedTextField } from './LocalizedTextField';

async function apiJson<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Service request returned ${response.status}`);
  return schema.parse(await response.json());
}

function defaultCopy(card: ServiceCard | null, translate: (language: Language, key: string) => string): ServiceCopy {
  const languageCopy = (language: Language) => {
    if (!card?.isBuiltin) return { title: '', shortDescription: '', description: '', points: ['', '', ''] };
    const prefix = `gallery.servicesPage.${card.id}`;
    const body = translate(language, `${prefix}.body`);
    return {
      title: translate(language, `${prefix}.title`), shortDescription: body, description: body,
      points: [1, 2, 3].map((number) => translate(language, `${prefix}.point${number}`)),
    };
  };
  return { fr: languageCopy('fr'), en: languageCopy('en') };
}

function EditableService({ card, enabledLanguages, primaryLanguage, readOnly, onChanged }: {
  card: ServiceCard | null;
  enabledLanguages: readonly Language[];
  primaryLanguage: Language;
  readOnly: boolean;
  onChanged: () => Promise<void>;
}) {
  const { i18n, t } = useTranslation();
  const translate = (language: Language, key: string) => i18n.getFixedT(language)(key);
  const [copy, setCopy] = useState<ServiceCopy>(() => card?.copy ?? defaultCopy(card, translate));
  const [enabled, setEnabled] = useState(card?.enabled ?? false);
  const [showOnHome, setShowOnHome] = useState(card?.showOnHome ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);

  const updateCopy = (language: Language, field: 'title' | 'shortDescription' | 'description' | number, value: string) => {
    const nextLanguage = { ...copy[language] };
    if (typeof field === 'number') {
      const points = [...nextLanguage.points];
      points[field] = value;
      nextLanguage.points = points;
    } else nextLanguage[field] = value;
    setCopy({ ...copy, [language]: nextLanguage });
    setSuccess(false);
  };

  const save = async () => {
    if (readOnly || busy) return;
    setError(false);
    setSuccess(false);
    const normalized = Object.fromEntries(LanguageSchema.options.map((language) => [language, {
      title: copy[language].title.trim(),
      shortDescription: copy[language].shortDescription.trim(),
      description: copy[language].description.trim(),
      points: copy[language].points.map((point) => point.trim()).filter(Boolean),
    }]));
    const parsed = ServiceCopySchema.safeParse(normalized);
    if (!parsed.success) { setError(true); return; }
    setBusy(true);
    try {
      if (card) {
        await apiJson(`/api/v1/admin/services/${card.id}`, ServiceCardSchema, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, showOnHome, sortOrder: card.sortOrder, copy: parsed.data }),
        });
      } else {
        await apiJson('/api/v1/admin/services', ServiceCardSchema, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
        });
      }
      await onChanged();
      setSuccess(true);
    } catch { setError(true); } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!card?.isBuiltin || readOnly || busy) return;
    setBusy(true); setError(false); setSuccess(false);
    try {
      await apiJson(`/api/v1/admin/services/${card.id}/reset`, ServiceCardSchema, { method: 'POST' });
      setCopy(defaultCopy(card, translate));
      await onChanged();
      setSuccess(true);
    } catch { setError(true); } finally { setBusy(false); }
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !card || readOnly || busy) return;
    setBusy(true);
    setError(false);
    setSuccess(false);
    const encoder = createImageEncoder();
    try {
      const encoded = await encoder.encodeService(file);
      const { revision } = await apiJson(`/api/v1/admin/services/${card.id}/image-revision`, ServiceImageRevisionSchema, { method: 'POST' });
      for (const variant of encoded.variants) {
        await apiJson(`/api/v1/admin/services/${card.id}/image/${revision}/${variant.name}`, ServiceImageUploadResponseSchema, {
          method: 'PUT', body: variant.blob, headers: {
            'Content-Type': variant.contentType,
            'X-Cadrora-Byte-Size': String(variant.byteSize),
            'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
            'X-Cadrora-Height': String(variant.height),
            'X-Cadrora-Width': String(variant.width),
          },
        });
      }
      await apiJson(`/api/v1/admin/services/${card.id}/image/${revision}/publish`, ServiceCardSchema, { method: 'POST' });
      await onChanged();
      setSuccess(true);
    } catch { setError(true); } finally { encoder.dispose(); setBusy(false); }
  };

  const label = card?.copy?.[primaryLanguage].title || (card?.isBuiltin
    ? translate(primaryLanguage, `gallery.servicesPage.${card.id}.title`)
    : copy[primaryLanguage].title || t('admin.serviceEditor.newService'));
  return <details className="admin-service-editor" open={!card}>
    <summary>{label}{card && !card.enabled ? ` · ${t('admin.serviceEditor.hidden')}` : ''}</summary>
    <div className="admin-service-editor__fields">
      {(['title', 'shortDescription', 'description'] as const).map((field) => <LocalizedTextField
        enabledLanguages={enabledLanguages} key={field} label={t(`admin.serviceEditor.${field}`)}
        languages={LanguageSchema.options} maxLength={field === 'title' ? 120 : field === 'shortDescription' ? 180 : 600}
        multiline={field === 'description'} onChange={(language, value) => updateCopy(language, field, value)}
        primaryLanguage={primaryLanguage} values={{ fr: copy.fr[field], en: copy.en[field] }} />)}
      {[0, 1, 2].map((index) => <LocalizedTextField enabledLanguages={enabledLanguages} key={index}
        label={t('admin.serviceEditor.point', { number: index + 1 })} languages={LanguageSchema.options}
        maxLength={200} onChange={(language, value) => updateCopy(language, index, value)} primaryLanguage={primaryLanguage}
        values={{ fr: copy.fr.points[index] ?? '', en: copy.en.points[index] ?? '' }} />)}
      {card ? <>
        <label className="admin-settings-services__option"><input checked={enabled} disabled={readOnly} onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span>{t('admin.serviceEditor.enabled')}</span></label>
        <label className="admin-settings-services__option"><input checked={showOnHome} disabled={readOnly} onChange={(event) => setShowOnHome(event.target.checked)} type="checkbox" /><span>{t('admin.serviceEditor.showOnHome')}</span></label>
        <label className="field"><span className="field__label">{t('admin.serviceEditor.photo')}</span>
          <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly} onChange={(event) => { void upload(event); }} type="file" />
        </label>
        <ServicePhoto card={card} className="admin-service-editor__preview" sizes="320px" />
        {!card.isBuiltin && !card.imageRevision ? <p className="field__hint">{t('admin.serviceEditor.photoRequired')}</p> : null}
      </> : null}
      <div className="admin-service-editor__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{card ? t('admin.serviceEditor.save') : t('admin.serviceEditor.create')}</Button>
        {card?.isBuiltin ? <Button disabled={busy || readOnly} onClick={() => { void reset(); }} variant="secondary">{t('admin.settings.restoreExample')}</Button> : null}
      </div>
      {error ? <p role="alert">{t('admin.serviceEditor.error')}</p> : null}
      {success ? <p role="status">{t('admin.serviceEditor.saved')}</p> : null}
    </div>
  </details>;
}

export function ServiceCatalogEditor({ enabledLanguages, homeLimit, primaryLanguage, readOnly }: {
  enabledLanguages: readonly Language[]; homeLimit: number; primaryLanguage: Language; readOnly: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const services = useQuery({ queryFn: () => apiJson('/api/v1/admin/services', ServiceCardsSchema), queryKey: ['admin-services'] });
  const [adding, setAdding] = useState(false);
  const [orderError, setOrderError] = useState(false);
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-services'] }),
      queryClient.invalidateQueries({ queryKey: ['public-services'] }),
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['public-site-settings'] }),
    ]);
  };
  if (services.isPending) return <Spinner label={t('admin.serviceEditor.loading')} />;
  if (services.isError || !services.data) return <p role="alert">{t('admin.serviceEditor.error')}</p>;
  const ordered = [...services.data].sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
  const eligible = ordered.filter((card) => card.enabled && card.showOnHome);
  const shown = eligible.slice(0, homeLimit);
  const move = async (index: number, direction: -1 | 1) => {
    const first = ordered[index];
    const second = ordered[index + direction];
    if (!first || !second || readOnly) return;
    setOrderError(false);
    try {
      await apiJson(`/api/v1/admin/services/${first.id}`, ServiceCardSchema, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: first.enabled, showOnHome: first.showOnHome, sortOrder: second.sortOrder, copy: first.copy }) });
      await apiJson(`/api/v1/admin/services/${second.id}`, ServiceCardSchema, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: second.enabled, showOnHome: second.showOnHome, sortOrder: first.sortOrder, copy: second.copy }) });
      await refresh();
    } catch { setOrderError(true); }
  };
  return <div className="admin-service-catalog">
    <p className="admin-card__description">{t('admin.serviceEditor.homeSummary', { selected: eligible.length, shown: shown.length, limit: homeLimit })}</p>
    <ol className="admin-service-catalog__list">
      {ordered.map((card, index) => <li key={card.id}>
        <div className="admin-service-catalog__order">
          <span>{shown.some((item) => item.id === card.id) ? t('admin.serviceEditor.onHome') : card.showOnHome ? t('admin.serviceEditor.beyondLimit') : ''}</span>
          <Button aria-label={t('admin.serviceEditor.moveUp', { name: card.copy?.[primaryLanguage].title ?? t(`gallery.servicesPage.${card.id}.title`) })}
            disabled={index === 0 || readOnly} onClick={() => { void move(index, -1); }} variant="secondary">↑</Button>
          <Button aria-label={t('admin.serviceEditor.moveDown', { name: card.copy?.[primaryLanguage].title ?? t(`gallery.servicesPage.${card.id}.title`) })}
            disabled={index === ordered.length - 1 || readOnly} onClick={() => { void move(index, 1); }} variant="secondary">↓</Button>
        </div>
        <EditableService card={card} enabledLanguages={enabledLanguages} onChanged={refresh} primaryLanguage={primaryLanguage} readOnly={readOnly} />
      </li>)}
    </ol>
    {orderError ? <p role="alert">{t('admin.serviceEditor.error')}</p> : null}
    {adding ? <EditableService card={null} enabledLanguages={enabledLanguages} onChanged={async () => { setAdding(false); await refresh(); }} primaryLanguage={primaryLanguage} readOnly={readOnly} />
      : <Button disabled={readOnly || ordered.length >= 30} onClick={() => setAdding(true)} variant="secondary">{t('admin.serviceEditor.add')}</Button>}
  </div>;
}
