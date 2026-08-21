import { requirePortalSession } from '@/lib/auth/session';
import { loadGuide } from '@/lib/guide/content';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { CoverForm } from './_components/CoverForm';

export default async function CoverScreen() {
  const session = await requirePortalSession();
  const guide = await loadGuide(session.guide_version_id);
  const i18n = t(session.language);

  return (
    <WizardShell current="cover" hasMinor={!!session.has_minor}>
      <div className="bg-white rounded-lg border border-ink/10 p-8 md:p-12 shadow-sm">
        <div className="text-xs uppercase tracking-widest text-terracotta mb-3">
          {i18n.sign.version} {guide.version}
        </div>
        <h1 className="font-display text-4xl text-ink mb-3">{guide.title}</h1>
        <p className="text-ink-soft text-lg leading-relaxed mb-8">{guide.subtitle}</p>

        <div className="bg-sand rounded p-5 mb-8 text-sm text-ink-soft leading-relaxed">
          {guide.sections[0]?.intro}
        </div>

        <div className="mb-6 p-4 bg-ink/5 rounded border-l-4 border-ink/30">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">{i18n.sign.leadNameReadonly}</div>
          <div className="font-medium text-ink">{session.lead_traveller_name}</div>
          <div className="text-xs text-ink-soft mt-1">{session.lead_traveller_email}</div>
          <div className="text-[10px] text-ink-soft mt-2 italic">{i18n.sign.contactToChange}</div>
        </div>

        <CoverForm
          defaultPartySize={session.party_size ?? 2}
          defaultHasMinor={session.has_minor ?? false}
        />
      </div>
    </WizardShell>
  );
}
