import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminSiteSettingsSchema } from '../../shared/schemas';
import type { Language, QuotaLimits, ThemeMode } from '../../shared/schemas';
import { Button, Input, MultiSelect, Select, Spinner } from '../components';
import { useAdminAccess } from './AdminAccessContext';

async function getAdminSiteSettings() {
  const response = await fetch('/api/v1/admin/site', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Site settings returned ${response.status}`);
  return AdminSiteSettingsSchema.parse(await response.json());
}

async function updateAdminSiteSettings(input: {
  defaultLanguage: Language;
  enabledLanguages: Language[];
  quotas: QuotaLimits;
  themeMode: ThemeMode;
}) {
  const response = await fetch('/api/v1/admin/site', {
    body: JSON.stringify(input),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(`Site settings update returned ${response.status}`);
  return AdminSiteSettingsSchema.parse(await response.json());
}

const BYTES_PER_GB = 1_000_000_000;

function decimalGigabytes(bytes: number): number {
  return Math.round((bytes / BYTES_PER_GB) * 10) / 10;
}

export function AdminSiteSettingsPage() {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryFn: getAdminSiteSettings, queryKey: ['admin-site-settings'] });
  const [saved, setSaved] = useState(false);
  const [defaultLanguageOverride, setDefaultLanguage] = useState<Language | null>(null);
  const [enabledLanguagesOverride, setEnabledLanguages] = useState<Language[] | null>(null);
  const update = useMutation({
    mutationFn: updateAdminSiteSettings,
    onSuccess: async (result) => {
      setSaved(true);
      queryClient.setQueryData(['admin-site-settings'], result);
      await queryClient.invalidateQueries({ queryKey: ['public-site-settings'] });
    },
  });

  if (settings.isPending) return <Spinner label={t('admin.settings.loading')} />;
  if (settings.isError || !settings.data) return <p role="alert">{t('admin.settings.error')}</p>;
  const defaultLanguage = defaultLanguageOverride ?? settings.data.defaultLanguage;
  const enabledLanguages = enabledLanguagesOverride ?? settings.data.enabledLanguages;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    setSaved(false);
    const values = new FormData(event.currentTarget);
    const themeMode = values.get('themeMode');
    const galleryLimit = Number(values.get('galleryLimit'));
    const storageLimitGb = Number(values.get('storageLimitGb'));
    const faceLimit = Number(values.get('faceLimit'));
    if (
      (themeMode === 'light' || themeMode === 'dark' || themeMode === 'both' || themeMode === 'system')
      && Number.isSafeInteger(galleryLimit)
      && Number.isFinite(storageLimitGb)
      && Number.isSafeInteger(faceLimit)
    ) update.mutate({
      defaultLanguage,
      enabledLanguages,
      quotas: {
        faceLimit,
        galleryLimit,
        storageLimitBytes: Math.round(storageLimitGb * BYTES_PER_GB),
      },
      themeMode,
    });
  };

  return (
    <section aria-labelledby="admin-site-settings-title" className="admin-card admin-site-settings">
      <p className="admin-demo-intro__eyebrow">{t('admin.settings.eyebrow')}</p>
      <h1 className="admin-card__title" id="admin-site-settings-title">{t('admin.settings.title')}</h1>
      <p className="admin-card__description">{t('admin.settings.description')}</p>
      <form className="admin-event-form" onSubmit={submit}>
        <MultiSelect
          hint={t('admin.settings.languagesHint')}
          label={t('admin.settings.languages')}
          onChange={(languages) => {
            setEnabledLanguages(languages);
            if (!languages.includes(defaultLanguage)) setDefaultLanguage(languages[0] ?? 'fr');
          }}
          options={[
            { label: t('admin.settings.languageFr'), value: 'fr' },
            { label: t('admin.settings.languageEn'), value: 'en' },
          ]}
          values={enabledLanguages}
        />
        <Select hint={t('admin.settings.languageHint')} label={t('admin.settings.language')} name="defaultLanguage" onChange={(event) => setDefaultLanguage(event.target.value as Language)} value={defaultLanguage}>
          {enabledLanguages.includes('fr') ? <option value="fr">{t('admin.settings.languageFr')}</option> : null}
          {enabledLanguages.includes('en') ? <option value="en">{t('admin.settings.languageEn')}</option> : null}
        </Select>
        <Select defaultValue={settings.data.themeMode} hint={t('admin.settings.themeHint')} label={t('admin.settings.themeMode')} name="themeMode">
          <option value="both">{t('admin.settings.themeBoth')}</option>
          <option value="light">{t('admin.settings.themeLight')}</option>
          <option value="dark">{t('admin.settings.themeDark')}</option>
          <option value="system">{t('admin.settings.themeSystem')}</option>
        </Select>
        <fieldset className="admin-quota-settings">
          <legend>{t('admin.settings.quotasTitle')}</legend>
          <p className="admin-card__description">{t('admin.settings.quotasDescription')}</p>
          <dl className="admin-quota-usage">
            <div><dt>{t('admin.settings.storageUsage')}</dt><dd>{t('admin.settings.storageUsageValue', {
              limit: decimalGigabytes(settings.data.quotas.storageLimitBytes),
              used: decimalGigabytes(settings.data.usage.storageBytes),
            })}</dd></div>
            <div><dt>{t('admin.settings.galleryUsage')}</dt><dd>{t('admin.settings.countUsageValue', {
              limit: settings.data.quotas.galleryLimit,
              used: settings.data.usage.galleries,
            })}</dd></div>
            <div><dt>{t('admin.settings.faceUsage')}</dt><dd>{t('admin.settings.countUsageValue', {
              limit: settings.data.quotas.faceLimit,
              used: settings.data.usage.faces,
            })}</dd></div>
          </dl>
          <div className="admin-quota-fields">
            <Input
              defaultValue={decimalGigabytes(settings.data.quotas.storageLimitBytes)}
              hint={t('admin.settings.storageLimitHint', { maximum: decimalGigabytes(settings.data.quotaCeilings.storageLimitBytes) })}
              label={t('admin.settings.storageLimit')}
              max={decimalGigabytes(settings.data.quotaCeilings.storageLimitBytes)}
              min="0.1"
              name="storageLimitGb"
              required
              step="0.1"
              type="number"
            />
            <Input
              defaultValue={settings.data.quotas.galleryLimit}
              hint={t('admin.settings.galleryLimitHint', { maximum: settings.data.quotaCeilings.galleryLimit })}
              label={t('admin.settings.galleryLimit')}
              max={settings.data.quotaCeilings.galleryLimit}
              min="1"
              name="galleryLimit"
              required
              step="1"
              type="number"
            />
            <Input
              defaultValue={settings.data.quotas.faceLimit}
              hint={t('admin.settings.faceLimitHint', { maximum: settings.data.quotaCeilings.faceLimit })}
              label={t('admin.settings.faceLimit')}
              max={settings.data.quotaCeilings.faceLimit}
              min="1"
              name="faceLimit"
              required
              step="1"
              type="number"
            />
          </div>
          <p className="field__hint">{t('admin.settings.quotasScope')}</p>
        </fieldset>
        {readOnly ? <p className="admin-card__description">{t('admin.settings.readOnly')}</p> : null}
        {update.isError ? <p role="alert">{t('admin.settings.error')}</p> : null}
        {saved ? <p role="status">{t('admin.settings.saved')}</p> : null}
        <Button disabled={readOnly || update.isPending} type="submit">{t('admin.settings.save')}</Button>
      </form>
    </section>
  );
}
