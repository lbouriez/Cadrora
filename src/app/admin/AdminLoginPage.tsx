import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import { Button, Input } from '../components';
import { siteProfile } from '../public/siteProfile';

export type TurnstileTokenProvider = () => Promise<string>;

export interface AdminLoginPageProps {
  demoMode?: boolean;
  onAuthenticated?: () => void;
  requestTurnstileToken: TurnstileTokenProvider;
}

interface LoginResponse {
  id: string;
}

type LoginResult = { kind: 'authenticated'; session: LoginResponse } | { kind: 'configuration' } | { kind: 'invalid' };

async function login(password: string, turnstileToken: string, demoMode: boolean): Promise<LoginResult> {
  const response = await fetch('/api/v1/admin/login', {
    body: JSON.stringify({
      account: demoMode ? 'demo' : 'owner',
      password,
      turnstileToken,
      ...(demoMode ? { username: siteProfile.demo.adminUsername } : {}),
    }),
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (response.status === 503) return { kind: 'configuration' };
  if (!response.ok) return { kind: 'invalid' };
  const body: unknown = await response.json();
  return body && typeof body === 'object' && 'id' in body && typeof body.id === 'string'
    ? { kind: 'authenticated', session: { id: body.id } }
    : { kind: 'invalid' };
}

/** Password login surface. The app integration supplies its rendered Turnstile token provider. */
export function AdminLoginPage({ demoMode = false, onAuthenticated, requestTurnstileToken }: AdminLoginPageProps) {
  const { t } = useTranslation();
  const [error, setError] = useState<'configuration' | 'credentials' | 'turnstile' | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = form.get('password');
    if (typeof password !== 'string') return;
    setPending(true);
    setError(null);
    try {
      const turnstileToken = await requestTurnstileToken();
      if (!turnstileToken) {
        setError('turnstile');
        return;
      }
      const result = await login(password, turnstileToken, demoMode);
      if (result.kind === 'configuration') {
        setError('configuration');
        return;
      }
      if (result.kind !== 'authenticated') {
        setError('credentials');
        return;
      }
      onAuthenticated?.();
    } catch {
      setError('turnstile');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="admin-login">
      <section className="admin-card admin-login__card" aria-labelledby="admin-login-title">
        <p className="admin-login__eyebrow">{t(demoMode ? 'admin.demo.eyebrow' : 'admin.login.eyebrow')}</p>
        <h1 className="admin-login__title" id="admin-login-title">{t(demoMode ? 'admin.demo.loginTitle' : 'admin.login.title')}</h1>
        <p>{t(demoMode ? 'admin.demo.loginBody' : 'admin.login.body')}</p>
        <form className="admin-login__form" onSubmit={(event) => { void submit(event); }}>
          {demoMode ? (
            <Input label={t('admin.demo.username')} name="username" readOnly value={siteProfile.demo.adminUsername} />
          ) : null}
          <Input
            autoComplete="current-password"
            defaultValue={demoMode ? siteProfile.demo.adminPassword : undefined}
            label={t('admin.login.password')}
            name="password"
            required
            type="password"
          />
          {error ? <p className="admin-login__error" role="alert">{t(
            error === 'turnstile'
              ? 'admin.login.turnstileUnavailable'
              : error === 'configuration'
                ? 'admin.login.configuration'
                : 'admin.login.error',
          )}</p> : null}
          <Button disabled={pending} type="submit">{t(demoMode ? 'admin.demo.submit' : 'admin.login.submit')}</Button>
        </form>
        {siteProfile.demo.enabled ? (
          <Link className="admin-login__switch" to={demoMode ? '/admin/login' : '/admin/login?demo=1'}>
            {t(demoMode ? 'admin.demo.ownerLink' : 'admin.login.demoLink')}
          </Link>
        ) : null}
      </section>
    </main>
  );
}
