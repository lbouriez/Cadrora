import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { SiteSettingsSchema } from '../../shared/schemas';
import type { ThemeMode } from '../../shared/schemas';
import { Button, Select, Spinner } from '../components';
import { useAdminAccess } from './AdminAccessContext';

async function getAdminSiteSettings() {
  const response = await fetch('/api/v1/admin/site', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Site settings returned ${response.status}`);
  return SiteSettingsSchema.parse(await response.json());
}

async function updateAdminSiteSettings(themeMode: ThemeMode) {
  const response = await fetch('/api/v1/admin/site', {
    body: JSON.stringify({ themeMode }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) throw new Error(`Site settings update returned ${response.status}`);
  return SiteSettingsSchema.parse(await response.json());
}

export function AdminSiteSettingsPage() {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryFn: getAdminSiteSettings, queryKey: ['admin-site-settings'] });
  const [saved, setSaved] = useState(false);
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

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    setSaved(false);
    const value = new FormData(event.currentTarget).get('themeMode');
    if (value === 'light' || value === 'dark' || value === 'both') update.mutate(value);
  };

  return (
    <section aria-labelledby="admin-site-settings-title" className="admin-card admin-site-settings">
      <p className="admin-demo-intro__eyebrow">{t('admin.settings.eyebrow')}</p>
      <h1 className="admin-card__title" id="admin-site-settings-title">{t('admin.settings.title')}</h1>
      <p className="admin-card__description">{t('admin.settings.description')}</p>
      <form className="admin-event-form" onSubmit={submit}>
        <Select defaultValue={settings.data.themeMode} disabled={readOnly} hint={t('admin.settings.themeHint')} label={t('admin.settings.themeMode')} name="themeMode">
          <option value="both">{t('admin.settings.themeBoth')}</option>
          <option value="light">{t('admin.settings.themeLight')}</option>
          <option value="dark">{t('admin.settings.themeDark')}</option>
        </Select>
        {readOnly ? <p className="admin-card__description">{t('admin.settings.readOnly')}</p> : null}
        {update.isError ? <p role="alert">{t('admin.settings.error')}</p> : null}
        {saved ? <p role="status">{t('admin.settings.saved')}</p> : null}
        <Button disabled={readOnly || update.isPending} type="submit">{t('admin.settings.save')}</Button>
      </form>
    </section>
  );
}
