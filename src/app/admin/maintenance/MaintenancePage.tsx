import type { ComponentType } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAdminAccess } from '../AdminAccessContext';
import { OverviewSection } from './OverviewSection';
import { JobsSection } from './JobsSection';
import { LogsSection } from './LogsSection';
import { MediaSection } from './MediaSection';
import './maintenance.css';

// Each section owns its query and UI. Adding one does not couple it to the
// others or start its reads/scans until the owner opens that section.
const sections: readonly { id: string; Component: ComponentType }[] = [
  { id: 'overview', Component: OverviewSection }, { id: 'jobs', Component: JobsSection },
  { id: 'logs', Component: LogsSection }, { id: 'media', Component: MediaSection },
];

export function MaintenancePage() {
  const { t } = useTranslation();
  const { readOnly } = useAdminAccess();
  const [params] = useSearchParams();
  const selected = sections.find((section) => section.id === params.get('section')) ?? sections[0]!;
  if (readOnly) return <p role="alert">{t('admin.maintenance.denied')}</p>;
  const Section = selected.Component;
  return <section className="admin-workspace maintenance-workspace">
    <header><h1>{t('admin.maintenance.title')}</h1><p>{t('admin.maintenance.description')}</p></header>
    <nav aria-label={t('admin.maintenance.navigation')} className="maintenance-navigation">
      {sections.map((section) => <Link className="admin-shell__nav-link" key={section.id}
        aria-current={section.id === selected.id ? 'page' : undefined} to={`?section=${section.id}`}>
        {t(`admin.maintenance.${section.id}`)}</Link>)}
    </nav>
    <section className="admin-card maintenance-section" key={selected.id}><Section /></section>
  </section>;
}
