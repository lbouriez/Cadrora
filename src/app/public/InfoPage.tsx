import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Spinner } from '../components';
import { getPublicSiteSettings } from './api';
import { PublicLayout } from './PublicLayout';
import { PublicPageIntro } from './PublicPageIntro';
import { ServiceAreaMap } from './ServiceAreaMap';
import { siteProfile } from './siteProfile';

export function PrivacyPage() {
  const Override = siteProfile.pages?.privacy;
  return Override ? <Override /> : <DefaultPrivacyPage />;
}

export function DefaultPrivacyPage() {
  const { t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const sections = ['operator', 'overview', 'gallery', 'security', 'ai', 'analytics', 'retention', 'rights'] as const;
  return (
    <PublicLayout>
      <article className="privacy-page">
        <PublicPageIntro eyebrow={t('gallery.privacyPage.eyebrow')}
          lead={t('gallery.privacyPage.lead')} title={t('gallery.privacyPage.title')}>
          <p className="privacy-page__updated">{t(siteProfile.demo.enabled
            ? 'gallery.privacyPage.updatedDemo'
            : 'gallery.privacyPage.updated')}</p>
        </PublicPageIntro>
        <div className="privacy-page__layout">
          <nav aria-label={t('gallery.privacyPage.onThisPage')} className="privacy-page__nav">
            <strong>{t('gallery.privacyPage.onThisPage')}</strong>
            {sections.map((section) => (
              <a href={`#privacy-${section}`} key={section}>{t(`gallery.privacyPage.${section}.title`)}</a>
            ))}
          </nav>
          <div className="privacy-page__content">
            {sections.map((section) => (
              <section id={`privacy-${section}`} key={section}>
                <h2>{t(`gallery.privacyPage.${section}.title`)}</h2>
                <p>{t(section === 'overview' && siteProfile.demo.enabled
                  ? 'gallery.privacyPage.overview.demoBody'
                  : `gallery.privacyPage.${section}.body`, { siteName: settings.data?.siteName ?? siteProfile.siteName })}</p>
              </section>
            ))}
          </div>
        </div>
        <div className="privacy-page__contact">
          <h2>{t('gallery.privacyPage.questionsTitle')}</h2>
          <p>{t('gallery.privacyPage.questionsBody')}</p>
          <Link className="button button--primary" to="/contact">{t('gallery.contact')}</Link>
        </div>
      </article>
    </PublicLayout>
  );
}

export function ContactPage() {
  const Override = siteProfile.pages?.contact;
  return Override ? <Override /> : <DefaultContactPage />;
}

export function DefaultContactPage() {
  const { t } = useTranslation();
  const settings = useQuery({ queryFn: getPublicSiteSettings, queryKey: ['public-site-settings'], retry: false, staleTime: 60_000 });
  const contact = {
    address: settings.data?.contactAddress ?? siteProfile.contact.address,
    email: settings.data?.contactEmail ?? siteProfile.contact.email,
    phone: settings.data?.contactPhone ?? siteProfile.contact.phone,
    serviceArea: settings.data?.serviceArea ?? siteProfile.contact.serviceArea,
  };
  const map = settings.data?.map;
  const contactItems = [
    contact.phone ? {
      key: 'phone',
      label: t('gallery.contactPhone'),
      value: contact.phone,
      href: `tel:${contact.phone.replace(/[^+\d]/g, '')}`,
    } : null,
    contact.email ? {
      key: 'email',
      label: t('gallery.contactEmail'),
      value: contact.email,
      href: `mailto:${contact.email}`,
    } : null,
    contact.address ? {
      key: 'address',
      label: t('gallery.contactAddress'),
      value: contact.address,
      href: null,
    } : null,
    contact.serviceArea ? {
      key: 'serviceArea',
      label: t('gallery.contactServiceArea'),
      value: contact.serviceArea,
      href: null,
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <PublicLayout>
      <article className="contact-page">
        <PublicPageIntro eyebrow={t('gallery.contactEyebrow')}
          lead={t('gallery.contactBody')} title={t('gallery.contactTitle')} />
        {contactItems.length > 0 ? (
          <dl className="contact-list">
            {contactItems.map((item) => (
              <div className="contact-list__item" key={item.key}>
                <dt>{item.label}</dt>
                <dd>{item.href ? <a href={item.href}>{item.value}</a> : item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="contact-page__unconfigured">{t('gallery.contactUnconfigured')}</p>
        )}
        {settings.isPending ? <Spinner label={t('gallery.loading')} /> : null}
        {!settings.isPending && map && map.centerLatitude !== null && map.centerLongitude !== null && map.radiusKm !== null ? (
          <ServiceAreaMap centerLatitude={map.centerLatitude} centerLongitude={map.centerLongitude} radiusKm={map.radiusKm} />
        ) : null}
        {!settings.isPending ? <section className="contact-page__expectations">
          <div>
            <p className="site-eyebrow">{t('gallery.contactExpectationEyebrow')}</p>
            <h2>{t('gallery.contactExpectationTitle')}</h2>
          </div>
          <ol>
            <li><strong>01</strong><span>{t('gallery.contactExpectation1')}</span></li>
            <li><strong>02</strong><span>{t('gallery.contactExpectation2')}</span></li>
            <li><strong>03</strong><span>{t('gallery.contactExpectation3')}</span></li>
          </ol>
        </section> : null}
      </article>
    </PublicLayout>
  );
}
