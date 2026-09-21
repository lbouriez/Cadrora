import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { siteProfile } from './siteProfile';

export function DemoExperienceCards() {
  const { t } = useTranslation();
  return (
    <div className="demo-experience-grid">
      <article className="demo-experience-card demo-experience-card--public">
        <span className="demo-experience-card__number">01</span>
        <p className="site-eyebrow">{t('gallery.demo.publicEyebrow')}</p>
        <h3>{t('gallery.demo.publicTitle')}</h3>
        <p>{t('gallery.demo.publicBody')}</p>
        <Link className="button button--primary" to={`/e/${siteProfile.demo.publicGallerySlug}`}>
          {t('gallery.demo.publicAction')}
        </Link>
      </article>
      <article className="demo-experience-card demo-experience-card--protected">
        <span className="demo-experience-card__number">02</span>
        <p className="site-eyebrow">{t('gallery.demo.privateEyebrow')}</p>
        <h3>{t('gallery.demo.privateTitle')}</h3>
        <p>{t('gallery.demo.privateBody')}</p>
        <p className="demo-credential">
          <span>{t('gallery.demo.password')}</span>
          <code>{siteProfile.demo.privateGalleryPassword}</code>
        </p>
        <Link className="button button--secondary" to={`/e/${siteProfile.demo.privateGallerySlug}`}>
          {t('gallery.demo.privateAction')}
        </Link>
      </article>
      <article className="demo-experience-card demo-experience-card--admin">
        <span className="demo-experience-card__number">03</span>
        <p className="site-eyebrow">{t('gallery.demo.adminEyebrow')}</p>
        <h3>{t('gallery.demo.adminTitle')}</h3>
        <p>{t('gallery.demo.adminBody')}</p>
        <dl className="demo-credentials">
          <div><dt>{t('gallery.demo.username')}</dt><dd><code>{siteProfile.demo.adminUsername}</code></dd></div>
          <div><dt>{t('gallery.demo.password')}</dt><dd><code>{siteProfile.demo.adminPassword}</code></dd></div>
        </dl>
        <Link className="button button--secondary" to="/admin/login?demo=1">
          {t('gallery.demo.adminAction')}
        </Link>
      </article>
      <article className="demo-experience-card demo-experience-card--ai">
        <span className="demo-experience-card__number">04</span>
        <p className="site-eyebrow">{t('gallery.demo.aiEyebrow')}</p>
        <h3>{t('gallery.demo.aiTitle')}</h3>
        <p>{t('gallery.demo.aiBody')}</p>
        <Link className="button button--secondary" to="/privacy#privacy-ai">
          {t('gallery.demo.aiAction')}
        </Link>
      </article>
    </div>
  );
}
