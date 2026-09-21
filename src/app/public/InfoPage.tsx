import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { PublicLayout } from './PublicLayout';
import { hasPublishedContactDetails, siteProfile } from './siteProfile';

export function PrivacyPage() {
  const { t } = useTranslation();
  const sections = ['overview', 'gallery', 'security', 'ai', 'retention', 'analytics', 'rights', 'operator'] as const;
  return (
    <PublicLayout>
      <article className="privacy-page">
        <header className="editorial-heading editorial-heading--privacy">
          <p className="site-eyebrow">{t('gallery.privacyPage.eyebrow')}</p>
          <h1>{t('gallery.privacyPage.title')}</h1>
          <p>{t('gallery.privacyPage.lead')}</p>
          <p className="privacy-page__updated">{t('gallery.privacyPage.updated')}</p>
        </header>
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
                <p>{t(`gallery.privacyPage.${section}.body`)}</p>
                {section === 'ai' ? (
                  <ul>
                    <li>{t('gallery.privacyPage.ai.point1')}</li>
                    <li>{t('gallery.privacyPage.ai.point2')}</li>
                    <li>{t('gallery.privacyPage.ai.point3')}</li>
                    <li>{t('gallery.privacyPage.ai.point4')}</li>
                  </ul>
                ) : null}
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
          <p className="contact-page__demo-note">{t('gallery.contactDemoNote')}</p>
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
        <section className="contact-page__expectations">
          <div>
            <p className="site-eyebrow">{t('gallery.contactExpectationEyebrow')}</p>
            <h2>{t('gallery.contactExpectationTitle')}</h2>
          </div>
          <ol>
            <li><strong>01</strong><span>{t('gallery.contactExpectation1')}</span></li>
            <li><strong>02</strong><span>{t('gallery.contactExpectation2')}</span></li>
            <li><strong>03</strong><span>{t('gallery.contactExpectation3')}</span></li>
          </ol>
        </section>
        <Link className="contact-page__back" to="/">← {t('gallery.backHome')}</Link>
      </article>
    </PublicLayout>
  );
}
