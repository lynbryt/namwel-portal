'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { t } from '@/lib/i18n';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-sand" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const i18n = t('en');

  const err = searchParams.get('error');
  const minutes = searchParams.get('minutes');
  const reason = searchParams.get('reason');

  let errorMsg: string | null = null;
  if (err === 'invalid') errorMsg = i18n.login.invalid;
  else if (err === 'locked') errorMsg = i18n.login.locked.replace('{minutes}', minutes ?? '60');
  else if (err === 'expired' || reason === 'expired') errorMsg = i18n.login.expired;
  else if (reason === 'inactive') errorMsg = i18n.login.inactive;

  const [ref, setRef] = useState('');
  const [pwd, setPwd] = useState('');
  const [pending, setPending] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(errorMsg);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrMsg(null);
    setPending(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, password: pwd }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        if (json.error === 'locked') {
          setErrMsg(i18n.login.locked.replace('{minutes}', String(json.minutes ?? 60)));
        } else if (json.error === 'expired') {
          setErrMsg(i18n.login.expired);
        } else if (json.error === 'inactive') {
          setErrMsg(i18n.login.inactive);
        } else {
          const dbg = json.debug ? ' [' + JSON.stringify(json.debug) + ']' : '';
          setErrMsg(i18n.login.invalid + dbg);
        }
        return;
      }
      router.push(json.redirect ?? '/sign');
      router.refresh();
    } catch {
      setErrMsg(i18n.common.error);
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-6">
            <img
              src="/namwel-logo.webp"
              alt="Namwel Tours & Car Rentals"
              className="h-16 w-auto"
            />
          </div>
          <h1 className="font-display text-3xl text-ink mb-2">{i18n.login.title}</h1>
          <p className="text-ink-soft text-sm leading-relaxed">{i18n.login.subtitle}</p>
        </div>

        <form onSubmit={submit} className="bg-white border border-ink/10 rounded-lg p-8 space-y-5">
          <div>
            <label htmlFor="reference" className="block text-xs uppercase tracking-wider text-ink-soft mb-2">
              {i18n.login.refLabel}
            </label>
            <input
              id="reference"
              type="text"
              required
              autoComplete="off"
              autoFocus
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              placeholder={i18n.login.refPlaceholder}
              className="w-full px-4 py-3 border border-ink/20 rounded font-mono text-base tracking-wider focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs uppercase tracking-wider text-ink-soft mb-2">
              {i18n.login.passwordLabel}
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder={i18n.login.passwordPlaceholder}
              className="w-full px-4 py-3 border border-ink/20 rounded text-base focus:outline-none focus:border-terracotta focus:ring-2 focus:ring-terracotta/20"
            />
          </div>

          {errMsg && (
            <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded px-4 py-3">
              {errMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark transition-colors disabled:opacity-50"
          >
            {pending ? '…' : i18n.login.submit}
          </button>
        </form>

        <p className="text-center text-xs text-ink-soft mt-6">
          <a href="mailto:support@alphaxtechnologies.org" className="underline hover:text-terracotta">
            {i18n.login.forgot}
          </a>
        </p>
      </div>
    </main>
  );
}
