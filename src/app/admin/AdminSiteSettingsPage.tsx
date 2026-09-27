import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { AdminSiteSettingsSchema, ApiErrorSchema, LanguageSchema, SiteCopySchema } from '../../shared/schemas';
import type { Language, QuotaLimits, ServiceKey, SiteCopy, ThemeMode } from '../../shared/schemas';
import { Button, Input, MultiSelect, Select, Spinner } from '../components';
import { siteProfile } from '../public/siteProfile';
import { useAdminAccess } from './AdminAccessContext';
import { CitySearch } from './CitySearch';
import { formatMediaStorage } from './formatMediaStorage';
import { LocalizedTextField } from './LocalizedTextField';
import { ServiceCatalogEditor } from './ServiceCatalogEditor';
import { HomeHeroEditor } from './HomeHeroEditor';

type SiteCopyDraft = Record<Language, { description: string; footerTagline: string }>;

async function getAdminSiteSettings() {
  const response = await fetch('/api/v1/admin/site', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Site settings returned ${response.status}`);
  return AdminSiteSettingsSchema.parse(await response.json());
}

async function updateAdminSiteSettings(input: {
  analyticsMeasurementId: string | null;
  contactAddress: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  defaultLanguage: Language;
  enabledLanguages: Language[];
  enabledServices: ServiceKey[];
  galleryDirectoryEnabled: boolean;
  homeGalleries: { enabled: boolean; limit: number };
  homeServicesLimit: number;
  map: { centerLatitude: number | null; centerLongitude: number | null; radiusKm: number | null };
  quotas: QuotaLimits;
  serviceArea: string | null;
  siteName: string;
  siteCopy: SiteCopy;
  themeMode: ThemeMode;
}) {
  const response = await fetch('/api/v1/admin/site', {
    body: JSON.stringify(input),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'PATCH',
  });
  if (!response.ok) {
    const error = ApiErrorSchema.safeParse(await response.json().catch(() => null));
    throw new Error(error.success ? error.data.code : `Site settings update returned ${response.status}`);
  }
  return AdminSiteSettingsSchema.parse(await response.json());
}

const BYTES_PER_GB = 1_000_000_000;

function formText(values: FormData, name: string): string {
  const value = values.get(name);
  return typeof value === 'string' ? value.trim() : '';
}

function decimalGigabytes(bytes: number): number {
  return Math.round((bytes / BYTES_PER_GB) * 10) / 10;
}

export function AdminSiteSettingsPage() {
  const { i18n, t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryFn: getAdminSiteSettings, queryKey: ['admin-site-settings'] });
  const [saved, setSaved] = useState(false);
  const [defaultLanguageOverride, setDefaultLanguage] = useState<Language | null>(null);
  const [enabledLanguagesOverride, setEnabledLanguages] = useState<Language[] | null>(null);
  const [siteCopyDraftOverride, setSiteCopyDraft] = useState<SiteCopyDraft | null>(null);
  const [formError, setFormError] = useState(false);
  const latitudeInput = useRef<HTMLInputElement>(null);
  const longitudeInput = useRef<HTMLInputElement>(null);
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
  const enabledServices = settings.data.enabledServices;
  const storageUsage = formatMediaStorage(settings.data.usage.storageBytes, i18n.language);
  const siteCopy = settings.data.siteCopy;
  const copyFallback = (language: Language, field: keyof SiteCopy['fr']) => field === 'description'
    ? siteProfile.siteDescription[language]
    : i18n.getFixedT(language)(`gallery.${field}`);
  const siteCopyDraft = siteCopyDraftOverride ?? Object.fromEntries(LanguageSchema.options.map((language) => [language, {
    description: siteCopy ? siteCopy[language].description ?? '' : copyFallback(language, 'description'),
    footerTagline: siteCopy ? siteCopy[language].footerTagline ?? '' : copyFallback(language, 'footerTagline'),
  }])) as SiteCopyDraft;
  const adminLanguage = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'fr';
  const primaryLanguage = enabledLanguages.includes(adminLanguage) ? adminLanguage : defaultLanguage;
  const changeCopy = (field: keyof SiteCopyDraft[Language], language: Language, value: string) => {
    setSaved(false);
    setSiteCopyDraft({
      ...siteCopyDraft,
      [language]: { ...siteCopyDraft[language], [field]: value },
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (readOnly) return;
    setSaved(false);
    setFormError(false);
    const values = new FormData(event.currentTarget);
    const themeMode = values.get('themeMode');
    const storageLimitGb = Number(values.get('storageLimitGb'));
    const faceLimit = Number(values.get('faceLimit'));
    const analyticsMeasurementId = formText(values, 'analyticsMeasurementId').toUpperCase() || null;
    const homeGalleryLimit = Number(values.get('homeGalleryLimit'));
    const homeServicesLimit = Number(values.get('homeServicesLimit'));
    const siteName = formText(values, 'siteName');
    const parsedCopy = SiteCopySchema.safeParse(Object.fromEntries(LanguageSchema.options.map((language) => {
      const description = siteCopyDraft[language].description.trim();
      return [language, {
        ...(description ? { description } : {}),
        footerTagline: siteCopyDraft[language].footerTagline.trim(),
      }];
    })));
    if (!parsedCopy.success) {
      setFormError(true);
      return;
    }
    const contactEmail = formText(values, 'contactEmail');
    const contactPhone = formText(values, 'contactPhone');
    const contactAddress = formText(values, 'contactAddress');
    const serviceArea = formText(values, 'serviceArea');
    const rawLatitude = formText(values, 'mapLatitude');
    const rawLongitude = formText(values, 'mapLongitude');
    const rawRadius = formText(values, 'mapRadiusKm');
    const mapComplete = Boolean(rawLatitude && rawLongitude && rawRadius);
    const mapEmpty = !rawLatitude && !rawLongitude && !rawRadius;
    if ((!mapComplete && !mapEmpty) || enabledServices.length === 0
      || !Number.isSafeInteger(homeGalleryLimit) || homeGalleryLimit < 1 || homeGalleryLimit > 12
      || !Number.isSafeInteger(homeServicesLimit) || homeServicesLimit < 1 || homeServicesLimit > 12) {
      setFormError(true);
      return;
    }
    if (
      (themeMode === 'light' || themeMode === 'dark' || themeMode === 'both' || themeMode === 'system')
      && Number.isFinite(storageLimitGb)
      && Number.isSafeInteger(faceLimit)
    ) update.mutate({
      analyticsMeasurementId,
      contactAddress,
      contactEmail,
      contactPhone,
      defaultLanguage,
      enabledLanguages,
      enabledServices,
      galleryDirectoryEnabled: values.get('galleryDirectoryEnabled') === 'on',
      homeGalleries: { enabled: values.get('homeGalleriesEnabled') === 'on', limit: homeGalleryLimit },
      homeServicesLimit,
      map: {
        centerLatitude: mapComplete ? Number(rawLatitude) : null,
        centerLongitude: mapComplete ? Number(rawLongitude) : null,
        radiusKm: mapComplete ? Number(rawRadius) : null,
      },
      quotas: {
        faceLimit,
        storageLimitBytes: Math.round(storageLimitGb * BYTES_PER_GB),
      },
      serviceArea,
      siteName,
      siteCopy: parsedCopy.data,
      themeMode,
    });
  };

  return (
    <section aria-labelledby="admin-site-settings-title" className="admin-card admin-site-settings">
      <p className="admin-demo-intro__eyebrow">{t('admin.settings.eyebrow')}</p>
      <h1 className="admin-card__title" id="admin-site-settings-title">{t('admin.settings.title')}</h1>
      <p className="admin-card__description">{t('admin.settings.description')}</p>
      <nav aria-label={t('admin.settings.sectionsLabel')} className="admin-settings-nav">
        <a href="#admin-settings-website">{t('admin.settings.websiteSection')}</a>
        <a href="#admin-settings-quotas">{t('admin.settings.quotasSection')}</a>
        <a href="#admin-settings-home">{t('admin.settings.homeGalleriesSection')}</a>
        <a href="#admin-settings-services">{t('admin.settings.servicesSection')}</a>
        <a href="#admin-settings-contact">{t('admin.settings.contactSection')}</a>
        <a href="#admin-settings-footer">{t('admin.settings.footerSection')}</a>
      </nav>
      <form className="admin-event-form" onSubmit={submit}>
        <fieldset className="admin-settings-section" id="admin-settings-website">
          <legend>{t('admin.settings.websiteSection')}</legend>
          <Input defaultValue={settings.data.siteName} label={t('admin.settings.siteName')} maxLength={120} name="siteName" required />
          <p className="admin-card__description">{t('admin.settings.siteDescriptionHint')}</p>
          <LocalizedTextField
            enabledLanguages={enabledLanguages}
            label={t('admin.settings.siteDescription')}
            languages={LanguageSchema.options}
            maxLength={300}
            multiline
            onChange={(language, value) => changeCopy('description', language, value)}
            primaryLanguage={primaryLanguage}
            required
            values={Object.fromEntries(LanguageSchema.options.map((language) => [language, siteCopyDraft[language].description]))}
          />
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
        <label className="admin-settings-services__option">
          <input defaultChecked={settings.data.galleryDirectoryEnabled} name="galleryDirectoryEnabled" type="checkbox" />
          <span>{t('admin.settings.galleryDirectoryEnabled')}</span>
        </label>
        <p className="field__hint">{t('admin.settings.galleryDirectoryHint')}</p>
        <Input
          autoComplete="off"
          defaultValue={settings.data.analyticsMeasurementId ?? ''}
          hint={t('admin.settings.analyticsHint')}
          label={t('admin.settings.analyticsMeasurementId')}
          name="analyticsMeasurementId"
          pattern="G-[A-Za-z0-9]{6,20}"
          placeholder="G-XXXXXXXXXX"
          type="text"
        />
        </fieldset>
        <fieldset className="admin-settings-section admin-quota-settings" id="admin-settings-quotas">
          <legend>{t('admin.settings.quotasTitle')}</legend>
          <p className="admin-card__description">{t('admin.settings.quotasDescription')}</p>
          <dl className="admin-quota-usage">
            <div><dt>{t('admin.settings.storageUsage')}</dt><dd>{t('admin.settings.storageUsageValue', {
              limit: decimalGigabytes(settings.data.quotas.storageLimitBytes),
              used: storageUsage.amount,
              unit: t(`admin.settings.storageUnits.${storageUsage.unit}`),
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
        <fieldset className="admin-settings-section" id="admin-settings-home">
          <legend>{t('admin.settings.homeGalleriesSection')}</legend>
          <HomeHeroEditor enabledLanguages={enabledLanguages} primaryLanguage={primaryLanguage} readOnly={readOnly} settings={settings.data} />
          <h2 className="admin-settings-section__subheading">{t('admin.settings.homeGalleriesTitle')}</h2>
          <p className="admin-card__description">{t('admin.settings.homeGalleriesHint')}</p>
          <label className="admin-settings-services__option">
            <input defaultChecked={settings.data.homeGalleries.enabled} name="homeGalleriesEnabled" type="checkbox" />
            <span>{t('admin.settings.homeGalleriesEnabled')}</span>
          </label>
          <Input
            defaultValue={settings.data.homeGalleries.limit}
            hint={t('admin.settings.homeGalleriesLimitHint')}
            label={t('admin.settings.homeGalleriesLimit')}
            max="12"
            min="1"
            name="homeGalleryLimit"
            required
            step="1"
            type="number"
          />
          <h2 className="admin-settings-section__subheading">{t('admin.settings.homeServicesTitle')}</h2>
          <Input defaultValue={settings.data.homeServicesLimit} hint={t('admin.settings.homeServicesLimitHint')}
            label={t('admin.settings.homeServicesLimit')} max="12" min="1" name="homeServicesLimit" required step="1" type="number" />
        </fieldset>
        <fieldset className="admin-settings-section" id="admin-settings-services">
          <legend>{t('admin.settings.servicesSection')}</legend>
          <p className="admin-card__description">{t('admin.settings.servicesHint')}</p>
          <ServiceCatalogEditor enabledLanguages={enabledLanguages} homeLimit={settings.data.homeServicesLimit} primaryLanguage={primaryLanguage} readOnly={readOnly} />
        </fieldset>
        <fieldset className="admin-settings-section" id="admin-settings-contact">
          <legend>{t('admin.settings.contactSection')}</legend>
          <p className="admin-card__description">{t('admin.settings.contactHint')}</p>
          <div className="admin-settings-contact-grid">
            <Input defaultValue={settings.data.contactEmail ?? siteProfile.contact.email ?? ''} label={t('admin.settings.contactEmail')} name="contactEmail" type="email" />
            <Input defaultValue={settings.data.contactPhone ?? siteProfile.contact.phone ?? ''} label={t('admin.settings.contactPhone')} maxLength={60} name="contactPhone" type="tel" />
            <Input defaultValue={settings.data.contactAddress ?? siteProfile.contact.address ?? ''} label={t('admin.settings.contactAddress')} maxLength={240} name="contactAddress" />
            <Input defaultValue={settings.data.serviceArea ?? siteProfile.contact.serviceArea ?? ''} hint={t('admin.settings.serviceAreaHint')} label={t('admin.settings.serviceArea')} maxLength={240} name="serviceArea" placeholder={t('admin.settings.serviceAreaPlaceholder')} />
          </div>
          <h2 className="admin-settings-section__subheading">{t('admin.settings.mapTitle')}</h2>
          <p className="admin-card__description">{t('admin.settings.mapHint')}</p>
          <CitySearch onSelect={({ latitude, longitude }) => {
            if (latitudeInput.current) latitudeInput.current.value = String(latitude);
            if (longitudeInput.current) longitudeInput.current.value = String(longitude);
          }} />
          <div className="admin-settings-contact-grid">
            <Input defaultValue={settings.data.map.centerLatitude ?? ''} inputRef={latitudeInput} label={t('admin.settings.mapLatitude')} max="90" min="-90" name="mapLatitude" step="any" type="number" />
            <Input defaultValue={settings.data.map.centerLongitude ?? ''} inputRef={longitudeInput} label={t('admin.settings.mapLongitude')} max="180" min="-180" name="mapLongitude" step="any" type="number" />
            <Input defaultValue={settings.data.map.radiusKm ?? ''} label={t('admin.settings.mapRadius')} max="2000" min="1" name="mapRadiusKm" step="1" type="number" />
          </div>
        </fieldset>
        <fieldset className="admin-settings-section" id="admin-settings-footer">
          <legend>{t('admin.settings.footerSection')}</legend>
          <p className="admin-card__description">{t('admin.settings.footerHint')}</p>
          <LocalizedTextField
            enabledLanguages={enabledLanguages}
            label={t('admin.settings.footerTagline')}
            languages={LanguageSchema.options}
            maxLength={160}
            onChange={(language, value) => changeCopy('footerTagline', language, value)}
            primaryLanguage={primaryLanguage}
            values={Object.fromEntries(LanguageSchema.options.map((language) => [language, siteCopyDraft[language].footerTagline]))}
          />
        </fieldset>
        {readOnly ? <p className="admin-card__description">{t('admin.settings.readOnly')}</p> : null}
        {formError ? <p role="alert">{t('admin.settings.formError')}</p> : null}
        {update.isError ? <p className="admin-settings-alert" role="alert">{t(update.error.message === 'PUBLIC_GALLERIES_REMAIN' ? 'admin.settings.publicGalleriesRemain' : 'admin.settings.error')}</p> : null}
        {saved ? <p role="status">{t('admin.settings.saved')}</p> : null}
        <Button disabled={readOnly || update.isPending} type="submit">{t('admin.settings.save')}</Button>
      </form>
    </section>
  );
}
