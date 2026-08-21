import Link from 'next/link';
import { t } from '@/lib/i18n';
import { CreateSessionForm } from './_components/CreateSessionForm';

export default function NewSessionPage() {
  const i18n = t('en');
  return (
    <main className="min-h-screen bg-sand">
      <header className="bg-white border-b border-ink/10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><img src="/namwel-logo.webp" alt="Namwel" className="h-9 w-auto" /></Link>
            <span className="text-ink-soft text-sm hidden sm:inline">· New signing session</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-ink-soft hover:text-terracotta">← Signings</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white border border-ink/10 rounded-lg p-6 md:p-8">
          <p className="text-ink-soft text-sm mb-6">
            Create a new signing session for a client. The lead traveller will receive a reference code and a one-time password. They have{' '}
            <strong>{i18n.checklist ? '' : ''}</strong>
            30 days by default to sign the guide.
          </p>
          <CreateSessionForm />
        </div>
      </div>
    </main>
  );
}
