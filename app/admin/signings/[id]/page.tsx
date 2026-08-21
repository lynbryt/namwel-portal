import { getAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

type Props = { params: { id: string } };

export default async function SigningDetail({ params }: Props) {
  const admin = getAdmin();

  const { data: session } = await admin
    .from('signature_sessions')
    .select('*')
    .eq('id', params.id)
    .single();
  if (!session) notFound();

  const { data: gv } = await admin
    .from('guide_versions')
    .select('version')
    .eq('id', session.guide_version_id)
    .single();

  const [{ data: travellers }, { data: scenarios }, { data: uploads }, { data: acks }, { data: checklist }, { data: sig }, { data: audit }] = await Promise.all([
    admin.from('travellers').select('*').eq('session_id', params.id).order('ordinal'),
    admin.from('child_scenarios').select('*'),
    admin.from('document_uploads').select('*').eq('session_id', params.id).order('uploaded_at', { ascending: false }),
    admin.from('section_acknowledgments').select('*').eq('session_id', params.id),
    admin.from('checklist_state').select('*').eq('session_id', params.id),
    admin.from('signature_records').select('*').eq('session_id', params.id).maybeSingle(),
    admin.from('audit_log').select('*').eq('session_id', params.id).order('occurred_at', { ascending: false }).limit(50),
  ]);

  return (
    <main className="min-h-screen bg-sand">
      <header className="bg-white border-b border-ink/10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><img src="/namwel-logo.webp" alt="Namwel" className="h-9 w-auto" /></Link>
            <span className="text-ink-soft text-sm hidden sm:inline">· Admin</span>
          </div>
          <Link href="/admin" className="text-sm text-ink-soft hover:text-terracotta">← Back to signings</Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <section className="bg-white border border-ink/10 rounded-lg p-6">
          <h2 className="font-display text-xl text-ink mb-4">Summary</h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Reference" value={<span className="font-mono">{session.reference_code}</span>} />
            <Field label="Booking" value={<span className="font-mono text-xs">{session.booking_id}</span>} />
            <Field label="Status" value={session.status} />
            <Field label="Guide version" value={gv?.version} />
            <Field label="Lead name" value={session.lead_traveller_name} />
            <Field label="Lead email" value={session.lead_traveller_email} />
            <Field label="Party size" value={session.party_size} />
            <Field label="Has minor" value={String(session.has_minor)} />
            <Field label="Created" value={new Date(session.created_at).toISOString()} />
            <Field label="Signed" value={session.signed_at ? new Date(session.signed_at).toISOString() : '—'} />
            <Field label="IP" value={session.completed_ip ?? '—'} />
            <Field label="User agent" value={<span className="text-xs">{session.completed_user_agent ?? '—'}</span>} />
            <Field label="Content hash" wide value={<span className="font-mono text-xs break-all">{session.content_hash ?? '—'}</span>} />
          </dl>
        </section>

        {sig && (
          <section className="bg-white border border-ink/10 rounded-lg p-6">
            <h2 className="font-display text-xl text-ink mb-4">Signature</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Signed name" value={sig.signed_name} />
              <Field label="Signed at" value={new Date(sig.signed_at).toISOString()} />
              <Field label="IP" value={sig.ip} />
              <Field label="Hash" wide value={<span className="font-mono text-xs break-all">{sig.content_hash}</span>} />
            </div>
            <details className="mt-4">
              <summary className="text-sm cursor-pointer text-ink-soft">View declarations</summary>
              <ul className="mt-3 text-sm space-y-1 list-disc pl-5">
                {(sig.declarations_json as any[]).map((d) => <li key={d.key}>{d.label}</li>)}
              </ul>
            </details>
          </section>
        )}

        <section className="bg-white border border-ink/10 rounded-lg p-6">
          <h2 className="font-display text-xl text-ink mb-4">Travellers ({(travellers ?? []).length})</h2>
          <table className="w-full text-sm">
            <thead><tr><th className="text-left py-1">Name</th><th className="text-left">DOB</th><th className="text-left">Role</th><th className="text-left">Adult/minor</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {(travellers ?? []).map((t) => (
                <tr key={t.id}><td className="py-2">{t.full_name}</td><td>{t.date_of_birth}</td><td>{t.role}</td><td>{t.is_minor ? 'minor' : 'adult'}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-ink/10 rounded-lg p-6">
          <h2 className="font-display text-xl text-ink mb-4">Documents ({(uploads ?? []).length})</h2>
          <table className="w-full text-sm">
            <thead><tr><th className="text-left py-1">Type</th><th className="text-left">Filename</th><th className="text-left">SHA-256</th><th className="text-left">Uploaded</th><th className="text-left">Verified</th></tr></thead>
            <tbody className="divide-y divide-ink/10">
              {(uploads ?? []).map((u) => (
                <tr key={u.id}>
                  <td className="py-2 font-mono text-xs">{u.doc_type}</td>
                  <td>{u.original_filename}</td>
                  <td className="font-mono text-xs">{u.sha256.slice(0, 16)}…</td>
                  <td className="text-xs">{new Date(u.uploaded_at).toISOString()}</td>
                  <td>{u.verified_by_admin ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="bg-white border border-ink/10 rounded-lg p-6">
          <h2 className="font-display text-xl text-ink mb-4">Audit log (last 50)</h2>
          <ul className="text-xs space-y-1 max-h-96 overflow-y-auto">
            {(audit ?? []).map((a) => (
              <li key={String(a.id)} className="font-mono text-ink-soft">
                <span className="text-ink">{new Date(a.occurred_at).toISOString()}</span> · {a.actor} · {a.event_type}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <dt className="text-xs uppercase tracking-wider text-ink-soft">{label}</dt>
      <dd className="text-ink mt-0.5">{value}</dd>
    </div>
  );
}
