import { requirePortalSession } from '@/lib/auth/session';
import { loadGuide } from '@/lib/guide/content';
import { t } from '@/lib/i18n';
import { WizardShell } from '@/app/(portal)/_components/WizardShell';
import { SignView } from './_components/SignView';

export default async function SignScreen() {
  const session = await requirePortalSession();
  const guide = await loadGuide(session.guide_version_id);
  const i18n = t(session.language);

  return (
    <WizardShell current="sign" hasMinor={!!session.has_minor}>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink mb-2">{i18n.sign_.title}</h1>
      </div>
      <SignView
        leadName={session.lead_traveller_name}
        leadEmail={session.lead_traveller_email}
        declarations={guide.declarations}
      />
    </WizardShell>
  );
}
