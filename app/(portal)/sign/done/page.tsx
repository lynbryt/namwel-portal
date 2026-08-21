import { requirePortalSession } from '@/lib/auth/session';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase/admin';

export default async function DoneScreen() {
  const session = await requirePortalSession();
  if (session.status !== 'signed') redirect('/sign');

  const admin = getAdmin();
  const { data: sig } = await admin
    .from('signature_records')
    .select('content_hash, signed_at')
    .eq('session_id', session.id)
    .single();

  const i18n = t(session.language);

  return (
    <WizardShell current="sign" hasMinor={!!session.has_minor}>
      <div className="bg-white border border-ink/10 rounded-lg p-8 md:p-12 text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-3xl text-ink mb-3">{i18n.done.title}</h1>
        <p className="text-ink-soft text-sm leading-relaxed max-w-md mx-auto mb-8">{i18n.done.body}</p>

        <div className="bg-sand rounded-lg p-4 mb-6 text-left text-xs font-mono space-y-1">
          <div><span className="text-ink-soft">Reference:</span> {session.reference_code}</div>
          <div><span className="text-ink-soft">Signed:</span> {new Date(sig?.signed_at ?? session.signed_at ?? Date.now()).toISOString()}</div>
          <div className="break-all"><span className="text-ink-soft">Hash:</span> {sig?.content_hash}</div>
        </div>

        <div className="space-y-3 max-w-sm mx-auto">
          <a
            href={`/api/download-pdf?session_id=${session.id}`}
            className="block w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark text-center"
          >
            {i18n.done.download}
          </a>
          <p className="text-xs text-ink-soft pt-4 border-t border-ink/10">{i18n.done.contact}</p>
        </div>
      </div>
    </WizardShell>
  );
}
