import Link from 'next/link';
import { getAdmin } from '@/lib/supabase/admin';
import { DepositsView } from './_components/DepositsView';

export const dynamic = 'force-dynamic';

export default async function DepositsPage() {
  const admin = getAdmin();
  const { data: deposits } = await admin
    .from('deposits')
    .select('id, booking_id, amount, currency, confirmed_at, reference, notes, created_at')
    .order('confirmed_at', { ascending: false });

  return (
    <main className="min-h-screen bg-sand">
      <header className="bg-white border-b border-ink/10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin"><img src="/namwel-logo.webp" alt="Namwel" className="h-9 w-auto" /></Link>
            <span className="text-ink-soft text-sm hidden sm:inline">· Deposits</span>
          </div>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-ink-soft hover:text-terracotta">← Dashboard</Link>
          </nav>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="bg-white border border-ink/10 rounded-lg p-6">
          <h2 className="font-display text-2xl text-ink mb-2">Confirmed deposits</h2>
          <p className="text-ink-soft text-sm mb-6">
            A signing session can only be created for a booking that has a confirmed deposit.
            Add or update deposits here.
          </p>
          <DepositsView deposits={deposits ?? []} />
        </div>
      </div>
    </main>
  );
}
