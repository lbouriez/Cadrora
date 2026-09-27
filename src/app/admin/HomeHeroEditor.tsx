import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { createImageEncoder } from '../../browser/images';
import { SERVICE_VARIANT_WIDTHS } from '../../shared/constants';
import { AdminSiteSettingsSchema, HomeHeroCopySchema, HomeHeroDestinationSchema, LanguageSchema, ServiceImageRevisionSchema, ServiceImageUploadResponseSchema } from '../../shared/schemas';
import type { AdminSiteSettings, HomeHeroCopy, Language } from '../../shared/schemas';
import { Button, Select } from '../components';
import { siteProfile } from '../public/siteProfile';
import { LocalizedTextField } from './LocalizedTextField';

async function apiJson<T>(url: string, schema: { parse(value: unknown): T }, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', ...init });
  if (!response.ok) throw new Error(`Home hero request returned ${response.status}`);
  return schema.parse(await response.json());
}

function defaultCopy(translate: (language: Language, key: string) => string): HomeHeroCopy {
  const languageCopy = (language: Language) => ({
    label: translate(language, 'gallery.heroEyebrow'),
    title: translate(language, 'gallery.heroTitle'),
    description: translate(language, 'gallery.heroLead'),
    caption: translate(language, 'gallery.heroArtCaption'),
    imageAlt: translate(language, 'gallery.heroImageAlt'),
  });
  return {
    fr: languageCopy('fr'), en: languageCopy('en'),
    buttons: [
      { labels: { fr: translate('fr', siteProfile.home.primaryAction.labelKey), en: translate('en', siteProfile.home.primaryAction.labelKey) },
        href: siteProfile.home.primaryAction.href as HomeHeroCopy['buttons'][number]['href'], variant: 'primary' },
      { labels: { fr: translate('fr', siteProfile.home.secondaryAction.labelKey), en: translate('en', siteProfile.home.secondaryAction.labelKey) },
        href: siteProfile.home.secondaryAction.href as HomeHeroCopy['buttons'][number]['href'], variant: 'secondary' },
    ],
  };
}

type HeroField = keyof HomeHeroCopy['fr'];
const fields: readonly { key: HeroField; maxLength: number; multiline?: boolean }[] = [
  { key: 'label', maxLength: 120 }, { key: 'title', maxLength: 120 },
  { key: 'description', maxLength: 500, multiline: true },
  { key: 'imageAlt', maxLength: 180 }, { key: 'caption', maxLength: 120 },
];

export function HomeHeroEditor({ settings, enabledLanguages, primaryLanguage, readOnly }: {
  settings: AdminSiteSettings;
  enabledLanguages: readonly Language[];
  primaryLanguage: Language;
  readOnly: boolean;
}) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const translate = (language: Language, key: string) => i18n.getFixedT(language)(key);
  const [copy, setCopy] = useState<HomeHeroCopy>(() => settings.homeHeroCopy ?? defaultCopy(translate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const destinations = HomeHeroDestinationSchema.options.filter((destination) =>
    destination !== '/e/find-your-photos/find' || siteProfile.home.primaryAction.href === destination);
  const updateField = (language: Language, field: HeroField, value: string) => {
    setCopy((previous) => ({ ...previous, [language]: { ...previous[language], [field]: value } }));
    setSaved(false);
  };
  const updateButton = (index: number, change: Partial<HomeHeroCopy['buttons'][number]>) => {
    setCopy((previous) => ({ ...previous, buttons: previous.buttons.map((button, position) => position === index ? { ...button, ...change } : button) }));
    setSaved(false);
  };
  const addButton = () => {
    setCopy((previous) => ({ ...previous, buttons: [...previous.buttons, { labels: { fr: '', en: '' }, href: '/contact', variant: 'secondary' }] }));
    setSaved(false);
  };
  const removeButton = (index: number) => {
    setCopy((previous) => ({ ...previous, buttons: previous.buttons.filter((_, position) => position !== index) }));
    setSaved(false);
  };
  const refresh = async (result?: AdminSiteSettings) => {
    if (result) queryClient.setQueryData(['admin-site-settings'], result);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['public-site-settings'] }),
    ]);
  };
  const save = async () => {
    if (busy || readOnly) return;
    const normalized = {
      ...copy,
      fr: Object.fromEntries(Object.entries(copy.fr).map(([key, value]) => [key, value.trim()])),
      en: Object.fromEntries(Object.entries(copy.en).map(([key, value]) => [key, value.trim()])),
      buttons: copy.buttons.map((button) => ({ ...button, labels: { fr: button.labels.fr.trim(), en: button.labels.en.trim() } })),
    };
    const parsed = HomeHeroCopySchema.safeParse(normalized);
    setError(false); setSaved(false);
    if (!parsed.success) { setError(true); return; }
    setBusy(true);
    try {
      const result = await apiJson('/api/v1/admin/site/home-hero', AdminSiteSettingsSchema, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data),
      });
      setCopy(parsed.data);
      await refresh(result);
      setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const reset = async () => {
    if (busy || readOnly) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      const result = await apiJson('/api/v1/admin/site/home-hero/reset', AdminSiteSettingsSchema, { method: 'POST' });
      setCopy(defaultCopy(translate));
      await refresh(result);
      setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || readOnly) return;
    setBusy(true); setError(false); setSaved(false);
    const encoder = createImageEncoder();
    try {
      const encoded = await encoder.encodeService(file);
      if (encoded.width < SERVICE_VARIANT_WIDTHS.large) throw new Error('HOME_HERO_IMAGE_TOO_SMALL');
      const { revision } = await apiJson('/api/v1/admin/services/home-hero/image-revision', ServiceImageRevisionSchema, { method: 'POST' });
      for (const variant of encoded.variants) {
        await apiJson(`/api/v1/admin/services/home-hero/image/${revision}/${variant.name}`, ServiceImageUploadResponseSchema, {
          method: 'PUT', body: variant.blob, headers: {
            'Content-Type': variant.contentType,
            'X-Cadrora-Byte-Size': String(variant.byteSize),
            'X-Cadrora-Checksum-Sha256': variant.checksumSha256,
            'X-Cadrora-Height': String(variant.height),
            'X-Cadrora-Width': String(variant.width),
          },
        });
      }
      await apiJson(`/api/v1/admin/services/home-hero/image/${revision}/publish`, ServiceImageRevisionSchema, { method: 'POST' });
      await refresh();
      setSaved(true);
    } catch { setError(true); } finally { encoder.dispose(); setBusy(false); }
  };
  return <details className="admin-service-editor">
    <summary>{t('admin.homeHero.sectionTitle')}</summary>
    <div className="admin-service-editor__fields">
      <p className="admin-card__description">{t('admin.homeHero.hint')}</p>
      {fields.map(({ key, maxLength, multiline }) => <LocalizedTextField
        enabledLanguages={enabledLanguages} key={key} label={t(`admin.homeHero.${key}`)}
        languages={LanguageSchema.options} maxLength={maxLength} multiline={multiline ?? false}
        onChange={(language, value) => updateField(language, key, value)} primaryLanguage={primaryLanguage}
        values={{ fr: copy.fr[key], en: copy.en[key] }} />)}
      <div className="admin-home-hero-buttons">
        <h3>{t('admin.homeHero.buttons')}</h3>
        {copy.buttons.map((button, index) => <div className="admin-home-hero-buttons__item" key={index}>
          <LocalizedTextField enabledLanguages={enabledLanguages} label={t('admin.homeHero.buttonText', { number: index + 1 })}
            languages={LanguageSchema.options} maxLength={60} onChange={(language, value) => updateButton(index, { labels: { ...button.labels, [language]: value } })}
            primaryLanguage={primaryLanguage} required values={button.labels} />
          <Select disabled={busy || readOnly} label={t('admin.homeHero.buttonDestination', { number: index + 1 })}
            onChange={(event) => updateButton(index, { href: event.target.value as HomeHeroCopy['buttons'][number]['href'] })} value={button.href}>
            {destinations.map((destination) => <option key={destination} value={destination}>{t(`admin.homeHero.destinations.${destination.replaceAll('/', '_').replace('#', 'section_')}`)}</option>)}
          </Select>
          <Select disabled={busy || readOnly} label={t('admin.homeHero.buttonStyle', { number: index + 1 })}
            onChange={(event) => updateButton(index, { variant: event.target.value as HomeHeroCopy['buttons'][number]['variant'] })} value={button.variant}>
            <option value="primary">{t('admin.homeHero.primaryStyle')}</option>
            <option value="secondary">{t('admin.homeHero.secondaryStyle')}</option>
          </Select>
          <Button disabled={busy || readOnly} onClick={() => removeButton(index)} variant="secondary">{t('admin.homeHero.removeButton', { number: index + 1 })}</Button>
        </div>)}
        <Button disabled={busy || readOnly || copy.buttons.length >= 6} onClick={addButton} variant="secondary">{t('admin.homeHero.addButton')}</Button>
      </div>
      <label className="field"><span className="field__label">{t('admin.homeHero.photo')}</span>
        <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly} onChange={(event) => { void upload(event); }} type="file" />
      </label>
      <img alt="" className="admin-service-editor__preview" src={`/home-hero-image/preview?v=${settings.homeHeroImageRevision ?? 0}`} />
      <p className="field__hint">{t('admin.homeHero.photoHint')}</p>
      <div className="admin-service-editor__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{t('admin.homeHero.save')}</Button>
        <Button disabled={busy || readOnly} onClick={() => { void reset(); }} variant="secondary">{t('admin.homeHero.reset')}</Button>
      </div>
      {error ? <p role="alert">{t('admin.homeHero.error')}</p> : null}
      {saved ? <p role="status">{t('admin.homeHero.saved')}</p> : null}
    </div>
  </details>;
}
