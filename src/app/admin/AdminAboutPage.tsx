import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminSiteSettingsSchema, LanguageSchema, UpdateAboutSchema } from '../../shared/schemas';
import type { AboutCopy, AdminSiteSettings, Language } from '../../shared/schemas';
import { Button, Spinner } from '../components';
import { useAdminAccess } from './AdminAccessContext';
import { getAdminSiteSettings } from './adminSiteApi';
import { LocalizedTextField } from './LocalizedTextField';
import { uploadMarketingPhoto } from './uploadMarketingPhoto';

async function updateAbout(input: unknown) {
  const response = await fetch('/api/v1/admin/site/about', {
    body: JSON.stringify(input), credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, method: 'PATCH',
  });
  if (!response.ok) throw new Error(`About update returned ${response.status}`);
  return AdminSiteSettingsSchema.parse(await response.json());
}

function AboutEditor({ settings, readOnly }: { settings: AdminSiteSettings; readOnly: boolean }) {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const fallback = (language: Language): AboutCopy['fr'] => ({
    title: i18n.getFixedT(language)('gallery.aboutPage.title'),
    body: i18n.getFixedT(language)('gallery.aboutPage.body'),
    imageAlt: i18n.getFixedT(language)('gallery.aboutPage.imageAlt'),
  });
  const [copy, setCopy] = useState<AboutCopy>(() => settings.aboutCopy ?? { fr: fallback('fr'), en: fallback('en') });
  const [enabled, setEnabled] = useState(settings.aboutEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const currentLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const primaryLanguage = settings.enabledLanguages.includes(currentLanguage) ? currentLanguage : settings.defaultLanguage;
  const refresh = async (result?: AdminSiteSettings) => {
    if (result) queryClient.setQueryData(['admin-site-settings'], result);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-site-settings'] }),
      queryClient.invalidateQueries({ queryKey: ['public-site-settings'] }),
    ]);
  };
  const save = async () => {
    if (busy || readOnly) return;
    const normalized = { enabled, copy: {
      fr: { title: copy.fr.title.trim(), body: copy.fr.body.trim(), imageAlt: copy.fr.imageAlt.trim() },
      en: { title: copy.en.title.trim(), body: copy.en.body.trim(), imageAlt: copy.en.imageAlt.trim() },
    } };
    const parsed = UpdateAboutSchema.safeParse(normalized);
    setError(false); setSaved(false);
    if (!parsed.success) { setError(true); return; }
    setBusy(true);
    try {
      const result = await updateAbout(parsed.data);
      setCopy(parsed.data.copy);
      await refresh(result);
      setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || readOnly) return;
    setBusy(true); setUploading(true); setError(false); setSaved(false);
    try {
      await uploadMarketingPhoto(file, { kind: 'about-hero' });
      await refresh();
      setSaved(true);
    } catch { setError(true); } finally { setBusy(false); setUploading(false); }
  };
  const resetPhoto = async () => {
    if (busy || readOnly) return;
    setBusy(true); setError(false); setSaved(false);
    try {
      const response = await fetch('/api/v1/admin/site/about/photo/reset', { credentials: 'same-origin', method: 'POST' });
      if (!response.ok) throw new Error(`About photo reset returned ${response.status}`);
      await refresh(AdminSiteSettingsSchema.parse(await response.json()));
      setSaved(true);
    } catch { setError(true); } finally { setBusy(false); }
  };
  const changeField = (language: Language, field: keyof AboutCopy['fr'], value: string) => {
    setCopy((previous) => ({ ...previous, [language]: { ...previous[language], [field]: value } }));
    setSaved(false);
  };

  return <div className="admin-workspace">
    <section className="admin-card admin-about">
      <h1 className="admin-card__title">{t('admin.about.title')}</h1>
      <p className="admin-card__description">{t('admin.about.hint')}</p>
      <label className="admin-settings-switch"><input checked={enabled} disabled={busy || readOnly}
        onChange={(event) => { setEnabled(event.target.checked); setSaved(false); }} type="checkbox" />
        <span>{t('admin.about.enabled')}</span></label>
      {([{ field: 'title', label: 'pageTitle', maxLength: 120 },
        { field: 'body', label: 'body', maxLength: 2000, multiline: true },
        { field: 'imageAlt', label: 'imageAlt', maxLength: 180 }] as const).map(({ field, label, maxLength, ...rest }) => (
        <LocalizedTextField enabledLanguages={settings.enabledLanguages} key={field} label={t(`admin.about.${label}`)}
          languages={LanguageSchema.options} maxLength={maxLength} multiline={'multiline' in rest}
          onChange={(language, value) => changeField(language, field, value)} primaryLanguage={primaryLanguage}
          required={field !== 'imageAlt'} values={{ fr: copy.fr[field], en: copy.en[field] }} />
      ))}
      <label className="field"><span className="field__label">{t('admin.about.photo')}</span>
        <input accept="image/jpeg,image/png,image/webp" className="field__input" disabled={busy || readOnly}
          onChange={(event) => { void upload(event); }} type="file" />
      </label>
      <img alt={t('admin.about.preview')} className="admin-about__preview" src={`/about-hero-image/preview?v=${settings.aboutImageRevision ?? 0}`} />
      <p className="field__hint">{t('admin.about.photoHint')}</p>
      <div className="admin-service-editor__actions">
        <Button disabled={busy || readOnly} onClick={() => { void save(); }}>{t('admin.about.save')}</Button>
        <Button disabled={busy || readOnly || !settings.aboutImageRevision} onClick={() => { void resetPhoto(); }} variant="secondary">{t('admin.about.resetPhoto')}</Button>
      </div>
      {uploading ? <p role="status">{t('admin.about.uploading')}</p> : null}
      {error ? <p role="alert">{t('admin.about.error')}</p> : null}
      {saved ? <p role="status">{t('admin.about.saved')}</p> : null}
    </section>
  </div>;
}

export function AdminAboutPage() {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const settings = useQuery({ queryFn: getAdminSiteSettings, queryKey: ['admin-site-settings'] });
  if (settings.isPending) return <Spinner label={t('admin.settings.loading')} />;
  if (settings.isError || !settings.data) return <p role="alert">{t('admin.settings.error')}</p>;
  return <AboutEditor readOnly={readOnly} settings={settings.data} />;
}
