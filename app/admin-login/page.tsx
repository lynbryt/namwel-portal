// Admin login page. The admin is a Supabase auth user with a row in
// user_roles. They sign in with email + password via Supabase auth.

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push('/admin');
      router.refresh();
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-ink/10 rounded-lg p-8 space-y-5">
        <div className="flex flex-col items-center gap-3">
          <img src="/namwel-logo.webp" alt="Namwel" className="h-14 w-auto" />
          <h1 className="font-display text-xl text-ink">Admin</h1>
        </div>
        <div>
          <label className="block text-xs text-ink-soft mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full px-3 py-2 border border-ink/20 rounded" />
        </div>
        <div>
          <label className="block text-xs text-ink-soft mb-1">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full px-3 py-2 border border-ink/20 rounded" />
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button type="submit" disabled={pending} className="w-full bg-ink text-white py-2 rounded disabled:opacity-50">
          {pending ? '…' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
