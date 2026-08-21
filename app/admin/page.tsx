import { getAdmin } from '@/lib/supabase/admin';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
  const admin = getAdmin();
  const { data: rows } = await admin
    .from('v_signing_overview')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <main className="min-h-screen bg-sand">
      <header className="bg-white border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/namwel-logo.webp" alt="Namwel" className="h-9 w-auto" />
            <span className="text-ink-soft text-sm hidden sm:inline">· Admin</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-ink-soft hover:text-terracotta">Signings</Link>
            <Link href="/admin/deposits" className="text-ink-soft hover:text-terracotta">Deposits</Link>
            <Link
              href="/admin/sessions/new"
              className="px-3 py-1.5 bg-terracotta text-white text-xs rounded font-medium hover:bg-terracotta-dark"
            >
              + New session
            </Link>
          </nav>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl text-ink">Recent signings</h2>
          <Link
            href="/admin/sessions/new"
            className="px-4 py-2 bg-terracotta text-white text-sm font-medium rounded hover:bg-terracotta-dark"
          >
            + New signing session
          </Link>
        </div>

        <div className="bg-white border border-ink/10 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-sand">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Ref</th>
                <th className="text-left px-4 py-2 font-medium">Booking</th>
                <th className="text-left px-4 py-2 font-medium">Lead</th>
                <th className="text-left px-4 py-2 font-medium">Party</th>
                <th className="text-left px-4 py-2 font-medium">Status</th>
                <th className="text-left px-4 py-2 font-medium">Created</th>
                <th className="text-left px-4 py-2 font-medium">Signed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/10">
              {(rows ?? []).map((r: any) => (
                <tr key={r.id} className="hover:bg-sand/50">
                  <td className="px-4 py-2 font-mono">
                    <Link href={`/admin/signings/${r.id}`} className="text-terracotta hover:underline">
                      {r.reference_code}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{r.booking_id}</td>
                  <td className="px-4 py-2 text-ink-soft text-xs">{r.lead_traveller_email}</td>
                  <td className="px-4 py-2">{r.party_size ?? '—'}{r.has_minor ? ' (minor)' : ''}</td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      r.status === 'signed' ? 'bg-success/10 text-success' :
                      r.status === 'in_progress' ? 'bg-warning/10 text-warning' :
                      r.status === 'pending' ? 'bg-ink/5 text-ink-soft' :
                      'bg-ink/5 text-ink-soft'
                    }`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-soft">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-xs text-ink-soft">{r.signed_at ? new Date(r.signed_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {(!rows || rows.length === 0) && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-ink-soft">No signings yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
