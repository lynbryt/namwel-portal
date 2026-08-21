import { requirePortalSession } from '@/lib/auth/session';
import { getAdmin } from '@/lib/supabase/admin';
import { loadGuide, groupSections, type GuideSection } from '@/lib/guide/content';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { ReadingView } from './_components/ReadingView';

export default async function ReadingScreen() {
  const session = await requirePortalSession();
  const guide = await loadGuide(session.guide_version_id);
  const i18n = t(session.language);

  const admin = getAdmin();
  const { data: acks } = await admin
    .from('section_acknowledgments')
    .select('section_key, acknowledged')
    .eq('session_id', session.id);

  const ackMap = new Map((acks ?? []).map((a) => [a.section_key, a.acknowledged]));

  const groups = groupSections(guide.sections);
  const sectionsByKey = new Map<string, GuideSection>(guide.sections.map((s) => [s.key, s]));

  return (
    <WizardShell current="reading" hasMinor={!!session.has_minor}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">{i18n.reading.title}</h1>
        <p className="text-ink-soft text-sm">{guide.disclaimer}</p>
      </div>

      <ReadingView
        groups={groups.map((g) => ({
          key: g.key,
          title: g.title,
          sections: g.sectionKeys.map((k) => sectionsByKey.get(k)!).filter(Boolean),
        }))}
        ackMap={Object.fromEntries(ackMap)}
        nextHref={session.has_minor ? '/sign/children' : '/sign/checklist'}
      />
    </WizardShell>
  );
}
