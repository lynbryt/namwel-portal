import { redirect } from 'next/navigation';
import { requirePortalSession } from '@/lib/auth/session';
import { getAdmin } from '@/lib/supabase/admin';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { ChildrenView } from './_components/ChildrenView';

export default async function ChildrenScreen() {
  const session = await requirePortalSession();
  if (!session.has_minor) redirect('/sign/checklist');

  const admin = getAdmin();
  const { data: travellers } = await admin
    .from('travellers')
    .select('id, full_name, date_of_birth, role, ordinal')
    .eq('session_id', session.id)
    .order('ordinal', { ascending: true });

  // Add lead as a traveller first if not present (party_size=1 etc).
  // We assume travellers are added during cover-flow; if no travellers yet,
  // we add a minimal lead row and prompt user to add kids.
  if (!travellers || travellers.length === 0) {
    return (
      <WizardShell current="children" hasMinor>
        <div className="bg-white border border-ink/10 rounded-lg p-8">
          <h1 className="font-display text-2xl text-ink mb-3">Add your party</h1>
          <p className="text-ink-soft mb-6">
            Before continuing, please add the travellers in your party. You (the lead) and any children.
          </p>
          <p className="text-sm text-ink-soft">
            (Traveller-add screen comes after this milestone. For now, return to the cover page.)
          </p>
        </div>
      </WizardShell>
    );
  }

  const minors = travellers.filter((t) => {
    const dob = new Date(t.date_of_birth);
    return (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25) < 18;
  });

  const { data: scenarios } = await admin
    .from('child_scenarios')
    .select('*')
    .in('traveller_id', minors.map((m) => m.id));

  const { data: childUploads } = await admin
    .from('document_uploads')
    .select('*')
    .eq('session_id', session.id)
    .in('traveller_id', minors.map((m) => m.id));

  const i18n = t(session.language);

  return (
    <WizardShell current="children" hasMinor>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">{i18n.children.title}</h1>
        <p className="text-ink-soft text-sm">
          For each child, choose the travel situation and upload the required documents.
        </p>
      </div>
      <ChildrenView
        minors={minors}
        scenarios={scenarios ?? []}
        uploads={childUploads ?? []}
      />
    </WizardShell>
  );
}
