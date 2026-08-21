import { requirePortalSession } from '@/lib/auth/session';
import { getAdmin } from '@/lib/supabase/admin';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { DocumentsView } from './_components/DocumentsView';
import { labelForDocType, requiredDocsForScenario } from '@/lib/uploads/doc-types';

export default async function DocumentsScreen() {
  const session = await requirePortalSession();
  const i18n = t(session.language);

  const admin = getAdmin();
  const { data: travellers } = await admin
    .from('travellers')
    .select('id, full_name, is_minor, ordinal')
    .eq('session_id', session.id)
    .order('ordinal', { ascending: true });

  const { data: scenarios } = await admin
    .from('child_scenarios')
    .select('traveller_id, scenario')
    .in('traveller_id', (travellers ?? []).filter((t) => t.is_minor).map((t) => t.id));

  const { data: uploads } = await admin
    .from('document_uploads')
    .select('id, doc_type, traveller_id, original_filename, byte_size, uploaded_at, verified_by_admin, rejected_reason')
    .eq('session_id', session.id);

  // Build the required matrix.
  const required: { doc_type: string; traveller_id: string | null; label: string }[] = [];
  for (const t of travellers ?? []) {
    required.push({ doc_type: 'passport', traveller_id: t.id, label: `Passport scan — ${t.full_name}` });
  }
  required.push({ doc_type: 'insurance_certificate', traveller_id: null, label: 'Travel insurance certificate' });
  if (session.has_minor) {
    for (const t of (travellers ?? []).filter((t) => t.is_minor)) {
      const sc = (scenarios ?? []).find((s) => s.traveller_id === t.id);
      const scenario = sc?.scenario ?? 'both_parents';
      for (const docType of requiredDocsForScenario(scenario)) {
        required.push({ doc_type: docType, traveller_id: t.id, label: `${labelForDocType(docType)} — ${t.full_name}` });
      }
    }
  }

  return (
    <WizardShell current="documents" hasMinor={!!session.has_minor}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">{i18n.documents.title}</h1>
        <p className="text-ink-soft text-sm">{i18n.documents.intro}</p>
      </div>
      <DocumentsView required={required} uploads={uploads ?? []} />
    </WizardShell>
  );
}
