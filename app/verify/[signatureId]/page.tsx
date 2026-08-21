// Public verification page. Anyone with the link can confirm that a
// signature record exists for this session and that the content hash
// matches. NO PII is shown.

import { getAdmin } from '@/lib/supabase/admin';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

type PageProps = { params: { signatureId: string } };

export default async function VerifyPage({ params }: PageProps) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('signature_records')
    .select('id, signed_at, content_hash, guide_version_id, session_id')
    .eq('id', params.signatureId)
    .maybeSingle();

  if (error || !data) notFound();

  const { data: session } = await admin
    .from('signature_sessions')
    .select('reference_code, lead_traveller_name, lead_traveller_email, party_size, has_minor, status, signed_at, content_hash')
    .eq('id', data.session_id)
    .single();

  const { data: gv } = await admin
    .from('guide_versions')
    .select('version')
    .eq('id', data.guide_version_id)
    .single();

  const ok = !!session && session.content_hash === data.content_hash && session.status === 'signed';

  return (
    <main className="min-h-screen bg-sand flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <div className="bg-white border border-ink/10 rounded-lg p-8 shadow-sm">
          {ok ? (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="font-display text-2xl text-ink text-center mb-2">Signature verified</h1>
              <p className="text-sm text-ink-soft text-center mb-6">
                This is a valid Namwel Tourist Information Guide signature.
              </p>
            </>
          ) : (
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-danger/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="font-display text-2xl text-danger text-center mb-2">Verification failed</h1>
              <p className="text-sm text-ink-soft text-center mb-6">
                The signature record could not be confirmed. Contact Namwel.
              </p>
            </>
          )}

          <dl className="text-sm space-y-3 border-t border-ink/10 pt-6">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Reference</dt>
              <dd className="font-mono">{session?.reference_code}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Signed at</dt>
              <dd>{new Date(data.signed_at).toISOString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Guide version</dt>
              <dd>{gv?.version}</dd>
            </div>
            <div>
              <dt className="text-ink-soft mb-1">Content hash (SHA-256)</dt>
              <dd className="font-mono text-xs break-all bg-sand p-2 rounded">{data.content_hash}</dd>
            </div>
          </dl>

          <p className="text-[10px] text-ink-soft text-center mt-6">
            No personal information is shown on this page. To obtain a copy of the signed document, contact Namwel directly.
          </p>
        </div>
      </div>
    </main>
  );
}
