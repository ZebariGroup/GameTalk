'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { RoomAnalytics } from '@/lib/adminStats';

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function formatIso(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function AdminDashboard({
  initial,
  loadError,
}: {
  initial: RoomAnalytics | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      router.replace('/admin/login');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Usage console</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Room counts come from your Supabase <code className="text-zinc-300">rooms</code> table.
            “Open rooms” means the row is not past <code className="text-zinc-300">expires_at</code>{' '}
            (or has no expiry). Voice and chat traffic are not persisted in the database, so live
            participant counts are not shown here.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
          >
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>

      {loadError && (
        <div
          className="mt-8 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200"
          role="alert"
        >
          <p className="font-medium">Could not load analytics</p>
          <p className="mt-1 text-red-300/90">{loadError}</p>
          <p className="mt-2 text-xs text-red-300/70">
            Ensure <code className="text-red-200">SUPABASE_SERVICE_ROLE_KEY</code> is set on the
            server and never exposed to the browser.
          </p>
        </div>
      )}

      {initial && !loadError && (
        <>
          <p className="mt-6 text-xs text-zinc-500">
            Last fetched: {formatIso(initial.fetchedAt)}
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Open rooms"
              value={initial.openRooms}
              hint="Not expired in DB (24h window when created in app)"
            />
            <StatCard label="Total rooms (all time)" value={initial.totalRooms} />
            <StatCard label="Created (24h)" value={initial.createdLast24h} />
            <StatCard label="Created (7d)" value={initial.createdLast7d} />
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-medium text-white">Recent rooms</h2>
            <p className="mt-1 text-sm text-zinc-500">Up to 50 most recently created.</p>
            <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-zinc-800 bg-zinc-900/80 text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Max members</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 bg-zinc-950/50">
                  {initial.recentRooms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                        No rooms yet.
                      </td>
                    </tr>
                  ) : (
                    initial.recentRooms.map((r) => (
                      <tr key={r.code} className="text-zinc-200">
                        <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                        <td className="px-3 py-2 tabular-nums">{r.max_members}</td>
                        <td className="px-3 py-2 text-zinc-400">{formatIso(r.created_at)}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {r.expires_at ? formatIso(r.expires_at) : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
