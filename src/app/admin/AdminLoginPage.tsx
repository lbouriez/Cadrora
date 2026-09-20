import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input } from '../components';

export type TurnstileTokenProvider = () => Promise<string>;

export interface AdminLoginPageProps {
  onAuthenticated?: () => void;
  requestTurnstileToken: TurnstileTokenProvider;
}

interface LoginResponse {
  id: string;
}

type LoginResult = { kind: 'authenticated'; session: LoginResponse } | { kind: 'configuration' } | { kind: 'invalid' };

async function login(password: string, turnstileToken: string): Promise<LoginResult> {
  const response = await fetch('/api/v1/admin/login', {
    body: JSON.stringify({ password, turnstileToken }),
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
export function AdminLoginPage({ onAuthenticated, requestTurnstileToken }: AdminLoginPageProps) {
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
      const result = await login(password, turnstileToken);
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
        <h1 className="admin-login__title" id="admin-login-title">{t('admin.login.title')}</h1>
        <form className="admin-login__form" onSubmit={(event) => { void submit(event); }}>
          <Input autoComplete="current-password" label={t('admin.login.password')} name="password" required type="password" />
          {error ? <p className="admin-login__error" role="alert">{t(
            error === 'turnstile'
              ? 'admin.login.turnstileUnavailable'
              : error === 'configuration'
                ? 'admin.login.configuration'
                : 'admin.login.error',
          )}</p> : null}
          <Button disabled={pending} type="submit">{t('admin.login.submit')}</Button>
        </form>
      </section>
    </main>
  );
}
