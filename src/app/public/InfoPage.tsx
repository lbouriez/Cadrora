import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PublicLayout } from './PublicLayout';
import { hasPublishedContactDetails, siteProfile } from './siteProfile';

export function PrivacyPage() {
  const { t } = useTranslation();
  return <PublicLayout><article className="info-page"><h1>{t('gallery.privacy')}</h1><p>{t('gallery.privacyBody')}</p><Link to="/">{t('gallery.backHome')}</Link></article></PublicLayout>;
}

export function ContactPage() {
  const { t } = useTranslation();
  const contactItems = [
    siteProfile.contact.phone ? {
      key: 'phone',
      label: t('gallery.contactPhone'),
      value: siteProfile.contact.phone,
      href: `tel:${siteProfile.contact.phone.replace(/[^+\d]/g, '')}`,
    } : null,
    siteProfile.contact.email ? {
      key: 'email',
      label: t('gallery.contactEmail'),
      value: siteProfile.contact.email,
      href: `mailto:${siteProfile.contact.email}`,
    } : null,
    siteProfile.contact.address ? {
      key: 'address',
      label: t('gallery.contactAddress'),
      value: siteProfile.contact.address,
      href: null,
    } : null,
    siteProfile.contact.serviceArea ? {
      key: 'serviceArea',
      label: t('gallery.contactServiceArea'),
      value: siteProfile.contact.serviceArea,
      href: null,
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  return (
    <PublicLayout>
      <article className="contact-page">
        <header className="contact-page__heading">
          <p className="site-eyebrow">{t('gallery.contactEyebrow')}</p>
          <h1>{t('gallery.contactTitle')}</h1>
          <p>{t('gallery.contactBody')}</p>
        </header>
        {hasPublishedContactDetails ? (
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
        <Link className="contact-page__back" to="/">← {t('gallery.backHome')}</Link>
      </article>
    </PublicLayout>
  );
}
