import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { AdminSessionResponseSchema, PublicationSummarySchema } from '../../shared/schemas';
import type { Session } from '../../shared/schemas';
import { Spinner } from '../components';
import { i18n } from '../i18n';
import { TurnstileChallenge } from '../security';
import type { TurnstileChallengeHandle } from '../security';
import { ImportPage } from './Import';
import { adminImportResources } from './ImportResources';
import { AdminEventsPage, AdminEventSettingsPage } from './AdminEventsPage';
import { AdminLayout } from './AdminLayout';
import { AdminLoginPage } from './AdminLoginPage';
import { PublishPanel } from './PublishPanel';
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

  const logout = session.data.authMode === 'password' ? async () => {
    await fetch('/api/v1/admin/logout', { credentials: 'same-origin', method: 'POST' });
    await navigate('/admin/login', { replace: true });
  } : undefined;
  const layoutProps = {
    subject: session.data.subject,
    ...(logout ? { onLogout: () => { void logout(); } } : {}),
  };

  return (
    <AdminLayout {...layoutProps}>
      {children}
    </AdminLayout>
  );
}

export function AdminLoginRoute() {
  const navigate = useNavigate();
  const challenge = useRef<TurnstileChallengeHandle>(null);
  return (
    <>
      <AdminLoginPage
        onAuthenticated={() => { void navigate('/admin', { replace: true }); }}
        requestTurnstileToken={() => challenge.current?.requestToken() ?? Promise.reject(new Error('TURNSTILE_UNAVAILABLE'))}
      />
      <TurnstileChallenge ref={challenge} />
    </>
  );
}

export function AdminDashboardRoute() {
  return <AdminFrame><AdminEventsPage /></AdminFrame>;
}

export function AdminImportRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryFn: async () => {
      const response = await fetch(`/api/v1/admin/events/${encodeURIComponent(eventId)}/publication`, { credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Publication summary returned ${response.status}`);
      return PublicationSummarySchema.parse(await response.json());
    },
    queryKey: ['publication-summary', eventId],
    refetchInterval: 3_000,
  });
  return (
    <AdminFrame>
      <div className="admin-workspace">
        <ImportPage eventId={eventId} />
        {summary.data ? (
          <PublishPanel
            eventId={eventId}
            onPublished={(published) => queryClient.setQueryData(['publication-summary', eventId], published)}
            summary={summary.data}
          />
        ) : null}
      </div>
    </AdminFrame>
  );
}

export function AdminEventSettingsRoute() {
  const { eventId = '' } = useParams<{ eventId: string }>();
  return <AdminFrame><AdminEventSettingsPage eventId={eventId} /></AdminFrame>;
}
