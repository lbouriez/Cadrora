import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { AdminSessionResponseSchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';
import { Spinner } from '../components';
import { i18n } from '../i18n';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { siteProfile } from '../public/siteProfile';
import { installPublicResources } from '../public/i18n';
import { ImportPage } from './Import';
import { adminImportResources } from './ImportResources';
import { AdminEventsPage, AdminEventSettingsPage } from './AdminEventsPage';
import { AdminFavoritesPage } from './AdminFavoritesPage';
import { AdminAccessProvider, useAdminAccess } from './AdminAccessContext';
import { getAdminEvent } from './adminEventsApi';
import { AdminLayout } from './AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminSiteSettingsPage } from './AdminSiteSettingsPage';
import { AdminPortfolioPage } from './AdminPortfolioPage';
import { AdminAboutPage } from './AdminAboutPage';
import { MaintenancePage } from './maintenance/MaintenancePage';
import { maintenanceResources } from './maintenance/resources';
import { mediaResources } from './maintenance/mediaResources';
import { PublishPanel } from './PublishPanel';
import { getPublicationSummary } from './publicationApi';
import { adminResourceFragment } from './resources';
import { serviceEditorResources } from './serviceEditorResources';
import { homeHeroResources } from './homeHeroResources';
import { portfolioResources } from './portfolioResources';
import { aboutResources } from './aboutResources';
import { syncAdminDraftSession } from './useAdminDraft';
import './admin.css';

// Session previews use the same localized copy as the public Home slides.
installPublicResources(i18n);

for (const language of ['en', 'fr'] as const) {
  i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
  i18n.addResourceBundle(language, 'translation', adminImportResources[language].translation, true, true);
  i18n.addResourceBundle(language, 'translation', serviceEditorResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', homeHeroResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', portfolioResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', aboutResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', mediaResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', maintenanceResources[language], true, true);
}

async function getSession(): Promise<Session | null> {
  const response = await fetch('/api/v1/admin/session', { credentials: 'same-origin' });
  if (response.status === 401) {
    syncAdminDraftSession(null);
    return null;
  }
  if (!response.ok) throw new Error(`Session returned ${response.status}`);
  const session = AdminSessionResponseSchema.parse(await response.json());
  syncAdminDraftSession(`${session.id}:${session.subject}:${session.access}`);
  return session;
}

function AdminFrame({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const session = useQuery({ queryFn: getSession, queryKey: ['admin-session'], retry: false });

  useEffect(() => {
    if (session.data === null) void navigate('/admin/login', { replace: true });
  }, [navigate, session.data]);

  if (session.isPending) return <main className="admin-login"><Spinner label="Cadrora" /></main>;
  if (session.isError || !session.data) return null;

  const logout = session.data.authMode === 'password' || session.data.authMode === 'demo' ? async () => {
    await fetch('/api/v1/admin/logout', { credentials: 'same-origin', method: 'POST' });
    syncAdminDraftSession(null);
    await navigate('/admin/login', { replace: true });
  } : undefined;
  const layoutProps = {
    readOnly: session.data.access === 'read-only',
    subject: session.data.subject,
    ...(logout ? { onLogout: () => { void logout(); } } : {}),
  };

  return (
    <AdminAccessProvider key={`${session.data.id}:${session.data.subject}:${session.data.access}`} readOnly={session.data.access === 'read-only'}>
      <AdminLayout {...layoutProps}>
        {children}
      </AdminLayout>
    </AdminAccessProvider>
  );
}

export function AdminLoginRoute() {
  const navigate = useNavigate();
  const challenge = useRef<TurnstileChallengeHandle>(null);
  return (
    <>
      <AdminLoginPage
        demoMode={siteProfile.demo.enabled && new URLSearchParams(window.location.search).get('demo') === '1'}
        onAuthenticated={() => { void navigate('/admin/galleries', { replace: true }); }}
        requestTurnstileToken={() => challenge.current?.requestToken() ?? Promise.reject(new Error('TURNSTILE_UNAVAILABLE'))}
      />
      <TurnstileChallenge ref={challenge} />
    </>
  );
}

function AdminImportContent({ eventId, replacementPhotoId }: { eventId: string; replacementPhotoId?: string }) {
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryFn: () => getPublicationSummary(eventId),
    queryKey: ['publication-summary', eventId],
    refetchInterval: readOnly ? false : 3_000,
  });
  const event = useQuery({ queryFn: () => getAdminEvent(eventId), queryKey: ['admin-event', eventId] });
  if (event.isPending) return <Spinner label={i18n.t('admin.events.loading')} />;
  const gallery = event.data;
  if (event.isError || !gallery) return <p role="alert">{i18n.t('admin.events.notFound')}</p>;
  if (readOnly) {
    return <div className="admin-workspace">
      <section className="admin-card">
        <h1 className="admin-card__title">{i18n.t('admin.demo.importTitle')}</h1>
        <p className="admin-card__description">{i18n.t('admin.demo.importBody')}</p>
      </section>
      {summary.data ? <PublishPanel eventId={eventId} readOnly showSettingsLink slug={gallery.slug} summary={summary.data} /> : null}
    </div>;
  }
  return (
    <div className="admin-workspace">
      <ImportPage eventId={eventId} galleryTitle={gallery.title} keepOriginals={gallery.keepOriginals} faceSearchEnabled={gallery.faceSearchEnabled} timezone={gallery.timezone} {...(replacementPhotoId ? { replacementPhotoId } : {})} />
      {summary.data ? (
        <PublishPanel
          eventId={eventId}
          slug={gallery.slug}
          onChanged={(published) => queryClient.setQueryData(['publication-summary', eventId], published)}
          showSettingsLink
          summary={summary.data}
        />
      ) : null}
    </div>
  );
}

export function AdminGalleriesRoute() {
  return <AdminFrame><AdminEventsPage /></AdminFrame>;
}

export function AdminImportRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const [searchParams] = useSearchParams();
  const replacementPhotoId = searchParams.get('replace') ?? undefined;
  return (
    <AdminFrame>
      <AdminImportContent eventId={eventId} {...(replacementPhotoId ? { replacementPhotoId } : {})} />
    </AdminFrame>
  );
}

function AdminFavoritesContent({ eventId }: { eventId: string }) {
  const event = useQuery({ queryFn: () => getAdminEvent(eventId), queryKey: ['admin-event', eventId] });
  if (event.isPending) return <Spinner label={i18n.t('admin.events.loading')} />;
  const gallery = event.data;
  if (event.isError || !gallery || gallery.access !== 'protected' || gallery.deletingAt) return <p role="alert">{i18n.t('admin.events.notFound')}</p>;
  return <AdminFavoritesPage event={gallery} />;
}

export function AdminFavoritesRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  return <AdminFrame><AdminFavoritesContent eventId={eventId} /></AdminFrame>;
}

export function AdminEventSettingsRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  return <AdminFrame><AdminEventSettingsPage eventId={eventId} /></AdminFrame>;
}

export function AdminSiteSettingsRoute() {
  return <AdminFrame><AdminSiteSettingsPage /></AdminFrame>;
}

export function AdminPortfolioRoute() {
  return <AdminFrame><AdminPortfolioPage /></AdminFrame>;
}

export function AdminAboutRoute() {
  return <AdminFrame><AdminAboutPage /></AdminFrame>;
}

export function AdminWorkerErrorsRoute() {
  return <Navigate to="/admin/maintenance?section=logs" replace />;
}

export function AdminMaintenanceRoute() {
  return <AdminFrame><MaintenancePage /></AdminFrame>;
}
