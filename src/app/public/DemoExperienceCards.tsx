import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { siteProfile } from './siteProfile';

export function DemoExperienceCards() {
  const { t } = useTranslation();
  return (
    <div className="demo-experience-grid">
      <article className="demo-experience-card demo-experience-card--ai demo-experience-card--feature">
        <div className="demo-experience-card__visual">
          <img alt="" src="/demo/face-search/test-portrait-amelia.webp" />
          <span>{t('gallery.demo.aiVisualLabel')}</span>
        </div>
        <div className="demo-experience-card__copy">
          <p className="site-eyebrow">{t('gallery.demo.aiEyebrow')}</p>
          <h3>{t('gallery.demo.aiTitle')}</h3>
          <p>{t('gallery.demo.aiBody')}</p>
          <Link className="button button--primary" to="/e/find-your-photos/find">
            {t('gallery.demo.aiAction')}
          </Link>
        </div>
      </article>
      <article className="demo-experience-card demo-experience-card--public">
        <p className="site-eyebrow">{t('gallery.demo.publicEyebrow')}</p>
        <h3>{t('gallery.demo.publicTitle')}</h3>
        <p>{t('gallery.demo.publicBody')}</p>
        <Link className="button button--primary" to={`/e/${siteProfile.demo.publicGallerySlug}`}>
          {t('gallery.demo.publicAction')}
        </Link>
      </article>
      <article className="demo-experience-card demo-experience-card--protected">
        <p className="site-eyebrow">{t('gallery.demo.privateEyebrow')}</p>
        <h3>{t('gallery.demo.privateTitle')}</h3>
        <p>{t('gallery.demo.privateBody')}</p>
        <Link className="button button--secondary" to={`/e/${siteProfile.demo.privateGallerySlug}`}>
          {t('gallery.demo.privateAction')}
        </Link>
      </article>
      <article className="demo-experience-card demo-experience-card--admin">
        <p className="site-eyebrow">{t('gallery.demo.adminEyebrow')}</p>
        <h3>{t('gallery.demo.adminTitle')}</h3>
        <p>{t('gallery.demo.adminBody')}</p>
        <Link className="button button--secondary" to="/admin/login?demo=1">
          {t('gallery.demo.adminAction')}
        </Link>
      </article>
    </div>
  );
}
