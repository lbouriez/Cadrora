import { useTranslation } from 'react-i18next';
import { MotionReveal } from '../components';

/** Profile-selected product guidance; photographer content stays in the owner catalog. */
export function ProductWorkflow() {
  const { t } = useTranslation();
  return <MotionReveal as="section" className="site-section product-workflow" labelledBy="workflow-title">
    <p className="site-eyebrow">{t('gallery.workflow.eyebrow')}</p>
    <h2 id="workflow-title">{t('gallery.workflow.title')}</h2>
    <ol>{(['present', 'share', 'select'] as const).map((step, index) => <li key={step}>
      <span aria-hidden="true">0{index + 1}</span><div><h3>{t(`gallery.workflow.${step}.title`)}</h3><p>{t(`gallery.workflow.${step}.body`)}</p></div>
    </li>)}</ol>
  </MotionReveal>;
}

export function ProductInstallation() {
  const { t } = useTranslation();
  return <MotionReveal as="section" id="installation" labelledBy="stack-title" className="site-section product-installation">
    <div><p className="site-eyebrow">{t('gallery.stack.eyebrow')}</p><h2 id="stack-title">{t('gallery.stack.title')}</h2>
      <p>{t('gallery.stack.body')}</p>
      <a className="button button--primary" data-marketing-action="setup_guide" href="https://github.com/lbouriez/Cadrora/blob/main/docs/deployment.md" rel="noreferrer" target="_blank">{t('gallery.stack.github')} <span aria-hidden="true">↗</span></a>
      <p className="product-installation__cost">{t('gallery.stack.cost')}</p>
    </div>
    <ol>{(['prepare', 'install', 'customize'] as const).map((step, index) => <li key={step}>
      <span aria-hidden="true">0{index + 1}</span><div><h3>{t(`gallery.stack.${step}.title`)}</h3><p>{t(`gallery.stack.${step}.body`)}</p></div>
    </li>)}</ol>
  </MotionReveal>;
}

export function ProductFaq() {
  const { t } = useTranslation();
  return <MotionReveal as="section" className="site-section product-faq" labelledBy="product-faq-title">
    <h2 id="product-faq-title">{t('gallery.faq.title')}</h2>
    <div>{(['hosting', 'search', 'editing', 'updates'] as const).map(key => <details key={key}>
      <summary>{t(`gallery.faq.${key}.question`)}<span aria-hidden="true">+</span></summary>
      <p>{t(`gallery.faq.${key}.answer`)}</p>
    </details>)}</div>
  </MotionReveal>;
}
