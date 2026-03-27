'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getSafeAdminRedirectPath } from '@/lib/adminRedirect';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeAdminRedirectPath(searchParams.get('next'));

  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || 'Sign-in failed');
        setPending(false);
        return;
      }
      router.replace(nextPath.startsWith('/') ? nextPath : '/admin');
      router.refresh();
    } catch {
      setError('Network error');
    }
    setPending(false);
  }

  return (
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="text-xl font-semibold tracking-tight text-white">Console sign-in</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Use the password from your server environment. Sessions are stored in an HttpOnly cookie.
      </p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-zinc-300">
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-white outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
            required
          />
        </label>
        {error && (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm pt-16 text-sm text-zinc-400">Loading…</div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
