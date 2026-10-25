import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import {
  LanguageSchema, ServiceCardSchema, ServiceCardsSchema, ServiceCopySchema, ServicePhotoAlignmentSchema,
  MAX_SERVICE_DESCRIPTION_LENGTH, MAX_SERVICE_INCLUSIONS, MAX_SERVICE_TARIFFS,
} from '../../shared/schemas';
import { MAX_SITE_SERVICES } from '../../shared/constants';
import type { Language, ServiceCard, ServiceCopy, ServicePhotoAlignment } from '../../shared/schemas';
import { Button, Select, Spinner } from '../components';
import { ServicePhoto } from '../public/ServicePhoto';
import { SessionStoryContent } from '../public/SessionStoryContent';
import { LocalizedTextField } from './LocalizedTextField';
import { uploadMarketingPhoto } from './uploadMarketingPhoto';
import { PhotoCompressionField } from './PhotoCompressionField';
import type { MarketingPhotoCompression } from '../../browser/images/marketingCompression';
import { useAdminDraft } from './useAdminDraft';

interface ServiceDraft {
  copy: ServiceCopy;
  enabled: boolean;
  showOnHome: boolean;
  photoAlignment: ServicePhotoAlignment;
  mobilePhotoAlignment: ServicePhotoAlignment | null;
}

async function apiJson<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Service request returned ${response.status}`);
  return schema.parse(await response.json());
}

function defaultCopy(card: ServiceCard | null, translate: (language: Language, key: string) => string): ServiceCopy {
  const languageCopy = (language: Language) => {
    if (!card?.isBuiltin) return { title: '', shortDescription: '', description: '', points: ['', '', ''], duration: '', priceRange: '', details: '' };
    const prefix = `gallery.servicesPage.${card.id}`;
    const body = translate(language, `${prefix}.body`);
    return {
      title: translate(language, `${prefix}.title`), shortDescription: body, description: body,
      points: [1, 2, 3].map((number) => translate(language, `${prefix}.point${number}`)),
      duration: '', priceRange: '', details: '',
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
  const { value: draft, setValue: setDraft, markSaved, dirty } = useAdminDraft<ServiceDraft>(`session:${card?.id ?? 'new'}`, {
    copy: card?.copy ?? defaultCopy(card, translate), enabled: card?.enabled ?? false,
    showOnHome: card?.showOnHome ?? false, photoAlignment: card?.photoAlignment ?? 'center',
    mobilePhotoAlignment: card?.mobilePhotoAlignment ?? null,
  }, !readOnly);
  const { copy, enabled, showOnHome, photoAlignment, mobilePhotoAlignment } = draft;
  const setField = <Field extends keyof ServiceDraft>(field: Field, value: ServiceDraft[Field]) => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };
  const previewCard = card ? { ...card, copy, photoAlignment, mobilePhotoAlignment } : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [compression, setCompression] = useState<MarketingPhotoCompression>('balanced');

  const updateCopy = (language: Language, field: 'title' | 'shortDescription' | 'description' | 'duration' | 'priceRange' | 'details' | 'goodToKnow' | number, value: string) => {
    const nextLanguage = { ...copy[language] };
    if (typeof field === 'number') {
      const points = [...nextLanguage.points];
      points[field] = value;
      nextLanguage.points = points;
    } else nextLanguage[field] = value;
    setField('copy', { ...copy, [language]: nextLanguage });
    setSuccess(false);
  };

  const tariffCount = Math.max(copy.fr.tariffs?.length ?? 0, copy.en.tariffs?.length ?? 0);
  const updateTariff = (language: Language, index: number, field: 'name' | 'price' | 'summary', value: string) => {
    const tariffs = Array.from({ length: tariffCount }, (_, position) =>
      copy[language].tariffs?.[position] ?? { name: '', price: '', summary: '' });
    tariffs[index] = { ...(tariffs[index] ?? { name: '', price: '', summary: '' }), [field]: value };
    setField('copy', { ...copy, [language]: { ...copy[language], tariffs } });
    setSuccess(false);
  };
  const resizeTariffs = (removeIndex?: number) => {
    if (removeIndex === undefined && tariffCount >= MAX_SERVICE_TARIFFS) return;
    const updateLanguage = (language: Language) => {
      const tariffs = Array.from({ length: tariffCount }, (_, index) =>
        copy[language].tariffs?.[index] ?? { name: '', price: '', summary: '' });
      if (removeIndex === undefined) tariffs.push({ name: '', price: '', summary: '' });
      else tariffs.splice(removeIndex, 1);
      return { ...copy[language], tariffs };
    };
    setField('copy', { fr: updateLanguage('fr'), en: updateLanguage('en') });
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
      duration: copy[language].duration?.trim() ?? '',
      priceRange: copy[language].priceRange?.trim() ?? '',
      details: copy[language].details?.trim() ?? '',
      tariffs: copy[language].tariffs ?? [],
      goodToKnow: copy[language].goodToKnow?.trim() ?? '',
    }]));
    const parsed = ServiceCopySchema.safeParse(normalized);
    if (!parsed.success) { setError(true); return; }
    setBusy(true);
    try {
      if (card) {
        await apiJson(`/api/v1/admin/services/${card.id}`, ServiceCardSchema, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled, showOnHome, sortOrder: card.sortOrder, copy: parsed.data, photoAlignment, mobilePhotoAlignment }),
        });
      } else {
        await apiJson('/api/v1/admin/services', ServiceCardSchema, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
        });
      }
      markSaved(draft);
      await onChanged();
      setSuccess(true);
    } catch { setError(true); } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!card?.isBuiltin || readOnly || busy) return;
    setBusy(true); setError(false); setSuccess(false);
    try {
      const restored = await apiJson(`/api/v1/admin/services/${card.id}/reset`, ServiceCardSchema, { method: 'POST' });
      const restoredDraft = { copy: defaultCopy(card, translate), enabled: restored.enabled,
        showOnHome: restored.showOnHome, photoAlignment: restored.photoAlignment,
        mobilePhotoAlignment: restored.mobilePhotoAlignment };
      setDraft(restoredDraft);
      markSaved(restoredDraft);
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
    setPhotoSaved(false);
    try {
      await uploadMarketingPhoto(file, { kind: 'service', id: card.id }, compression);
      await onChanged();
      setPhotoSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };

  const label = card?.copy?.[primaryLanguage].title || (card?.isBuiltin
    ? translate(primaryLanguage, `gallery.servicesPage.${card.id}.title`)
    : copy[primaryLanguage].title || t('admin.serviceEditor.newService'));
  return <details className="admin-service-editor" open={!card}>
    <summary>{label}{card && !card.enabled && !card.showOnHome ? ` · ${t('admin.serviceEditor.hidden')}` : ''}</summary>
    <div className="admin-service-editor__fields">
      {(['title', 'shortDescription', 'description'] as const).map((field) => <LocalizedTextField
        enabledLanguages={enabledLanguages} key={field} label={t(`admin.serviceEditor.${field}`)}
        languages={LanguageSchema.options} maxLength={field === 'title' ? 120 : field === 'shortDescription' ? 180 : MAX_SERVICE_DESCRIPTION_LENGTH}
        multiline={field === 'description'} onChange={(language, value) => updateCopy(language, field, value)}
        primaryLanguage={primaryLanguage} values={{ fr: copy.fr[field], en: copy.en[field] }} />)}
      {Array.from({ length: MAX_SERVICE_INCLUSIONS }, (_, index) => <LocalizedTextField enabledLanguages={enabledLanguages} key={index}
        label={t('admin.serviceEditor.point', { number: index + 1 })} languages={LanguageSchema.options}
        maxLength={200} onChange={(language, value) => updateCopy(language, index, value)} primaryLanguage={primaryLanguage}
        values={{ fr: copy.fr.points[index] ?? '', en: copy.en.points[index] ?? '' }} />)}
      {(['duration', 'priceRange', 'details'] as const).map((field) => <LocalizedTextField
        enabledLanguages={enabledLanguages} key={field} label={t(`admin.serviceEditor.${field}`)}
        languages={LanguageSchema.options} maxLength={field === 'duration' ? 120 : field === 'priceRange' ? 160 : 2000}
        multiline={field === 'details'} onChange={(language, value) => updateCopy(language, field, value)}
        primaryLanguage={primaryLanguage} values={{ fr: copy.fr[field] ?? '', en: copy.en[field] ?? '' }} />)}
      <fieldset className="admin-service-framing" disabled={busy || readOnly}>
        <legend>{t('admin.serviceEditor.tariffs')}</legend>
        <p className="field__hint">{t('admin.serviceEditor.tariffsHint')}</p>
        {Array.from({ length: tariffCount }, (_, index) => <fieldset className="admin-service-framing" key={index}>
          <legend>{t('admin.serviceEditor.tariffNumber', { number: index + 1 })}</legend>
          {(['name', 'price', 'summary'] as const).map((field) => <LocalizedTextField
            key={field} enabledLanguages={enabledLanguages} languages={LanguageSchema.options} required
            label={t(`admin.serviceEditor.tariff${field === 'name' ? 'Name' : field === 'price' ? 'Price' : 'Summary'}`, { number: index + 1 })}
            maxLength={field === 'name' ? 120 : field === 'price' ? 160 : 600} multiline={field === 'summary'}
            onChange={(language, value) => updateTariff(language, index, field, value)} primaryLanguage={primaryLanguage}
            values={{ fr: copy.fr.tariffs?.[index]?.[field] ?? '', en: copy.en.tariffs?.[index]?.[field] ?? '' }} />)}
          <Button variant="secondary" onClick={() => resizeTariffs(index)}>{t('admin.serviceEditor.removeTariff', { number: index + 1 })}</Button>
        </fieldset>)}
        <Button variant="secondary" disabled={tariffCount >= MAX_SERVICE_TARIFFS} onClick={() => resizeTariffs()}>{t('admin.serviceEditor.addTariff')}</Button>
      </fieldset>
      <LocalizedTextField enabledLanguages={enabledLanguages} languages={LanguageSchema.options}
        label={t('admin.serviceEditor.goodToKnow')} maxLength={1000} multiline primaryLanguage={primaryLanguage}
        values={{ fr: copy.fr.goodToKnow ?? '', en: copy.en.goodToKnow ?? '' }}
        onChange={(language, value) => updateCopy(language, 'goodToKnow', value)} />
      {card ? <>
        <label className="admin-settings-services__option"><input checked={enabled} disabled={readOnly} onChange={(event) => setField('enabled', event.target.checked)} type="checkbox" /><span>{t('admin.serviceEditor.enabled')}</span></label>
        <label className="admin-settings-services__option"><input checked={showOnHome} disabled={readOnly} onChange={(event) => setField('showOnHome', event.target.checked)} type="checkbox" /><span>{t('admin.serviceEditor.showOnHome')}</span></label>
        <PhotoCompressionField disabled={busy || readOnly} onChange={setCompression} value={compression} />
        <label className="field"><span className="field__label">{t('admin.serviceEditor.photo')}</span>
          <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly} onChange={(event) => { void upload(event); }} type="file" />
        </label>
        <fieldset className="admin-service-framing" disabled={busy || readOnly}>
          <legend>{t('admin.serviceEditor.framing')}</legend>
          <p className="field__hint">{t('admin.serviceEditor.framingHint')}</p>
          <Select label={t('admin.serviceEditor.desktopAlignment')} value={photoAlignment} onChange={(event) => {
            setField('photoAlignment', ServicePhotoAlignmentSchema.parse(event.target.value)); setSuccess(false);
          }}>
            {ServicePhotoAlignmentSchema.options.map((alignment) => <option key={alignment} value={alignment}>{t(`admin.serviceEditor.alignment.${alignment}`)}</option>)}
          </Select>
          <Select label={t('admin.serviceEditor.mobileAlignment')} value={mobilePhotoAlignment ?? ''} onChange={(event) => {
            setField('mobilePhotoAlignment', event.target.value === '' ? null : ServicePhotoAlignmentSchema.parse(event.target.value)); setSuccess(false);
          }}>
            <option value="">{t('admin.serviceEditor.sameAlignment')}</option>
            {ServicePhotoAlignmentSchema.options.map((alignment) => <option key={alignment} value={alignment}>{t(`admin.serviceEditor.alignment.${alignment}`)}</option>)}
          </Select>
          {previewCard ? <div className="admin-service-framing__previews">
            <figure><figcaption>{t('admin.serviceEditor.desktopPreview')}</figcaption>
              <div className="admin-service-framing__default"><ServicePhoto card={previewCard} className="admin-service-editor__preview" sizes="320px" framing="desktop" immediate /></div>
            </figure>
            <figure><figcaption>{t('admin.serviceEditor.mobilePreview')}</figcaption>
              <div className="session-story session-story--preview"><div className="session-story__panel">
                <SessionStoryContent card={previewCard} immediate preview />
              </div></div>
            </figure>
          </div> : null}
        </fieldset>
        {!card.isBuiltin && !card.imageRevision ? <p className="field__hint">{t('admin.serviceEditor.photoRequired')}</p> : null}
      </> : null}
      <div className="admin-service-editor__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{card ? t('admin.serviceEditor.save') : t('admin.serviceEditor.create')}</Button>
        {card?.isBuiltin ? <Button disabled={busy || readOnly} onClick={() => { void reset(); }} variant="secondary">{t('admin.settings.restoreExample')}</Button> : null}
      </div>
      {error ? <p role="alert">{t('admin.serviceEditor.error')}</p> : null}
      {success && !dirty ? <p role="status">{t('admin.serviceEditor.saved')}</p> : null}
      {photoSaved ? <p role="status">{t('admin.serviceEditor.photoSaved')}</p> : null}
      {dirty ? <p role="status">{t('admin.serviceEditor.unsaved')}</p> : null}
    </div>
  </details>;
}

export function ServiceCatalogEditor({ enabledLanguages, primaryLanguage, readOnly }: {
  enabledLanguages: readonly Language[]; primaryLanguage: Language; readOnly: boolean;
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
  const eligible = ordered.filter((card) => card.showOnHome);
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
    <p className="admin-card__description">{t('admin.serviceEditor.homeSummary', { count: eligible.length })}</p>
    <ol className="admin-service-catalog__list">
      {ordered.map((card, index) => <li key={card.id}>
        <div className="admin-service-catalog__order">
          <span>{card.showOnHome ? t('admin.serviceEditor.onHome') : ''}</span>
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
      : <Button disabled={readOnly || ordered.length >= MAX_SITE_SERVICES} onClick={() => setAdding(true)} variant="secondary">{t('admin.serviceEditor.add')}</Button>}
  </div>;
}
