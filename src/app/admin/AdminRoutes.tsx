import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

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
import { WorkerErrorsPage } from './WorkerErrorsPage';
import { PublishPanel } from './PublishPanel';
import { getPublicationSummary } from './publicationApi';
import { adminResourceFragment } from './resources';
import { serviceEditorResources } from './serviceEditorResources';
import { homeHeroResources } from './homeHeroResources';
import { portfolioResources } from './portfolioResources';
import { aboutResources } from './aboutResources';
import './admin.css';

const diagnosticsResources = {
  en: { admin: { diagnostics: {
    title: 'Worker errors', description: 'Recent server errors kept for 30 days. Request IDs help match an error to a visitor report.',
    denied: 'This view requires owner access.', loading: 'Loading errors…', error: 'Could not load errors.',
    empty: 'No recorded errors.', time: 'Time', route: 'Route', code: 'Error', request: 'Request ID', loadMore: 'Load more errors',
    mediaTitle: 'Media inventory', mediaDescription: 'Scan 100 R2 objects per request. Objects uploaded less than 15 minutes ago are ignored. A missing D1 row needs manual review; this screen never deletes objects.',
    scope: { galleries: 'Scan galleries', services: 'Scan sessions', portfolio: 'Scan portfolio' },
    scanning: 'Scanning media…', scanError: 'Could not scan media.', noUntracked: 'No untracked objects in scanned pages.',
    scanStatus: 'Scanned {{count}} objects. Cleanup jobs: {{pending}} pending, {{running}} running, {{failed}} failed.',
    objectKey: 'R2 object key', uploaded: 'Uploaded', scanNext: 'Scan next 100',
  } } },
  fr: { admin: { diagnostics: {
    title: 'Erreurs Worker', description: 'Erreurs récentes du serveur conservées 30 jours. L’identifiant de requête aide à retrouver un incident signalé.',
    denied: 'Cette vue exige l’accès propriétaire.', loading: 'Chargement des erreurs…', error: 'Impossible de charger les erreurs.',
    empty: 'Aucune erreur enregistrée.', time: 'Heure', route: 'Route', code: 'Erreur', request: 'ID de requête', loadMore: 'Charger plus d’erreurs',
    mediaTitle: 'Inventaire des médias', mediaDescription: 'Analyse de 100 objets R2 par requête. Les objets téléversés depuis moins de 15 minutes sont ignorés. Une absence dans D1 exige une vérification manuelle; cette page ne supprime rien.',
    scope: { galleries: 'Analyser les galeries', services: 'Analyser les séances', portfolio: 'Analyser le portfolio' },
    scanning: 'Analyse des médias…', scanError: 'Impossible d’analyser les médias.', noUntracked: 'Aucun objet sans référence dans les pages analysées.',
    scanStatus: '{{count}} objets analysés. Tâches de nettoyage : {{pending}} en attente, {{running}} en cours, {{failed}} en échec.',
    objectKey: 'Clé de l’objet R2', uploaded: 'Téléversé', scanNext: 'Analyser les 100 suivants',
  } } },
} as const;

// Session previews use the same localized copy as the public Home slides.
installPublicResources(i18n);

for (const language of ['en', 'fr'] as const) {
  i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
  i18n.addResourceBundle(language, 'translation', adminImportResources[language].translation, true, true);
  i18n.addResourceBundle(language, 'translation', serviceEditorResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', homeHeroResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', portfolioResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', aboutResources[language], true, true);
  i18n.addResourceBundle(language, 'translation', diagnosticsResources[language], true, true);
}

async function getSession(): Promise<Session | null> {
  const response = await fetch('/api/v1/admin/session', { credentials: 'same-origin' });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session returned ${response.status}`);
  return AdminSessionResponseSchema.parse(await response.json());
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
    await navigate('/admin/login', { replace: true });
  } : undefined;
  const layoutProps = {
    readOnly: session.data.access === 'read-only',
    subject: session.data.subject,
    ...(logout ? { onLogout: () => { void logout(); } } : {}),
  };

  return (
    <AdminAccessProvider readOnly={session.data.access === 'read-only'}>
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
  return <AdminFrame><WorkerErrorsPage /></AdminFrame>;
}
