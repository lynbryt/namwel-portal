import { requirePortalSession } from '@/lib/auth/session';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase/admin';
import { DoneView } from './_components/DoneView';

export default async function DoneScreen() {
  const session = await requirePortalSession();
  if (session.status !== 'signed') redirect('/sign');

  const admin = getAdmin();
  const { data: sig } = await admin
    .from('signature_records')
    .select('content_hash, signed_at')
    .eq('session_id', session.id)
    .single();

  const { data: sessRow } = await admin
    .from('signature_sessions')
    .select('pdf_path')
    .eq('id', session.id)
    .single();

  const i18n = t(session.language);

  return (
    <WizardShell current="sign" hasMinor={!!session.has_minor}>
      <DoneView
        referenceCode={session.reference_code}
        signedAt={sig?.signed_at ?? session.signed_at ?? new Date().toISOString()}
        contentHash={sig?.content_hash ?? ''}
        sessionId={session.id}
        initialPdfPath={sessRow?.pdf_path ?? null}
        copy={{
          title: i18n.done.title,
          body: i18n.done.body,
          download: i18n.done.download,
          contact: i18n.done.contact,
          generating: i18n.done.generating ?? 'Preparing your signed PDF…',
          stillGenerating: i18n.done.stillGenerating ?? 'Still preparing… (this can take up to a minute on first render)',
        }}
      />
    </WizardShell>
  );
}
