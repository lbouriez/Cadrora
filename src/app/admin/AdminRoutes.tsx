import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AdminSessionResponseSchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';
import { Spinner } from '../components';
import { i18n } from '../i18n';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { siteProfile } from '../public/siteProfile';
import { ImportPage } from './Import';
import { adminImportResources } from './ImportResources';
import { AdminEventsPage, AdminEventSettingsPage } from './AdminEventsPage';
import { AdminAccessProvider, useAdminAccess } from './AdminAccessContext';
import { AdminLayout } from './AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
import { AdminSiteSettingsPage } from './AdminSiteSettingsPage';
import { PublishPanel } from './PublishPanel';
import { getPublicationSummary } from './publicationApi';
import { adminResourceFragment } from './resources';
import './admin.css';

for (const language of ['en', 'fr'] as const) {
  i18n.addResourceBundle(language, 'translation', adminResourceFragment[language], true, true);
  i18n.addResourceBundle(language, 'translation', adminImportResources[language].translation, true, true);
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
        onAuthenticated={() => { void navigate('/admin', { replace: true }); }}
        requestTurnstileToken={() => challenge.current?.requestToken() ?? Promise.reject(new Error('TURNSTILE_UNAVAILABLE'))}
      />
      <TurnstileChallenge ref={challenge} />
    </>
  );
}

function AdminImportContent({ eventId }: { eventId: string }) {
  const { readOnly } = useAdminAccess();
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryFn: () => getPublicationSummary(eventId),
    queryKey: ['publication-summary', eventId],
    refetchInterval: readOnly ? false : 3_000,
  });
  if (readOnly) {
    return <div className="admin-workspace">
      <section className="admin-card">
        <h1 className="admin-card__title">{i18n.t('admin.demo.importTitle')}</h1>
        <p className="admin-card__description">{i18n.t('admin.demo.importBody')}</p>
      </section>
      {summary.data ? <PublishPanel eventId={eventId} readOnly summary={summary.data} /> : null}
    </div>;
  }
  return (
    <div className="admin-workspace">
      <ImportPage eventId={eventId} />
      {summary.data ? (
        <PublishPanel
          eventId={eventId}
          onChanged={(published) => queryClient.setQueryData(['publication-summary', eventId], published)}
          summary={summary.data}
        />
      ) : null}
    </div>
  );
}

export function AdminDashboardRoute() {
  return <AdminFrame><AdminEventsPage /></AdminFrame>;
}

export function AdminImportRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  return (
    <AdminFrame>
      <AdminImportContent eventId={eventId} />
    </AdminFrame>
  );
}

export function AdminEventSettingsRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  return <AdminFrame><AdminEventSettingsPage eventId={eventId} /></AdminFrame>;
}

export function AdminSiteSettingsRoute() {
  return <AdminFrame><AdminSiteSettingsPage /></AdminFrame>;
}
