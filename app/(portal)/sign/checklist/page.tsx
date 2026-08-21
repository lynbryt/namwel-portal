import { requirePortalSession } from '@/lib/auth/session';
import { loadGuide } from '@/lib/guide/content';
import { getAdmin } from '@/lib/supabase/admin';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { ChecklistView } from './_components/ChecklistView';

export default async function ChecklistScreen() {
  const session = await requirePortalSession();
  const guide = await loadGuide(session.guide_version_id);
  const i18n = t(session.language);

  const admin = getAdmin();
  const { data: state } = await admin
    .from('checklist_state')
    .select('item_key, checked')
    .eq('session_id', session.id);

  const stateMap = Object.fromEntries((state ?? []).map((s) => [s.item_key, s.checked]));

  return (
    <WizardShell current="checklist" hasMinor={!!session.has_minor}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">{i18n.checklist.title}</h1>
        <p className="text-ink-soft text-sm">{i18n.checklist.intro}</p>
      </div>

      <ChecklistView
        items={guide.checklist}
        groupLabels={i18n.checklist.groups}
        initialState={stateMap}
        nextHref="/sign/documents"
      />
    </WizardShell>
  );
}
