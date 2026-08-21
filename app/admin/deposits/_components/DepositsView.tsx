'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createConfirmedDeposit, revokeDeposit } from '../_actions';

type Deposit = {
  id: string;
  booking_id: string;
  amount: number;
  currency: string;
  confirmed_at: string | null;
  reference: string | null;
  notes: string | null;
  created_at: string;
};

export function DepositsView({ deposits }: { deposits: Deposit[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      booking_id: String(fd.get('booking_id') ?? '').trim(),
      amount: Number(fd.get('amount') ?? 0),
      currency: String(fd.get('currency') ?? 'NAD').trim().toUpperCase(),
      reference: String(fd.get('reference') ?? '').trim() || undefined,
      notes: String(fd.get('notes') ?? '').trim() || undefined,
    };
    if (!input.booking_id) { setError('Booking ID is required'); return; }
    if (!input.amount || input.amount <= 0) { setError('Amount must be > 0'); return; }
    startTransition(async () => {
      try {
        await createConfirmedDeposit(input);
        (e.target as HTMLFormElement).reset();
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? 'Failed');
      }
    });
  };

  const revoke = (bookingId: string) => {
    if (!confirm(`Revoke deposit for ${bookingId}?`)) return;
    startTransition(async () => {
      try {
        await revokeDeposit(bookingId);
        router.refresh();
      } catch (err: any) {
        setError(err?.message ?? 'Failed');
      }
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="bg-sand rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-medium text-ink">Add or replace a deposit</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input name="booking_id" required placeholder="BOOKING-12345" className="px-3 py-2 border border-ink/20 rounded text-sm font-mono" />
          <div className="grid grid-cols-2 gap-2">
            <input name="amount" type="number" min={0} step="0.01" required placeholder="5000" className="px-3 py-2 border border-ink/20 rounded text-sm" />
            <input name="currency" defaultValue="NAD" maxLength={4} className="px-3 py-2 border border-ink/20 rounded text-sm uppercase" />
          </div>
          <input name="reference" placeholder="Bank ref (TRX-12345)" className="px-3 py-2 border border-ink/20 rounded text-sm" />
          <input name="notes" placeholder="Notes (optional)" className="px-3 py-2 border border-ink/20 rounded text-sm" />
        </div>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button type="submit" disabled={pending} className="px-4 py-2 bg-terracotta text-white text-sm rounded hover:bg-terracotta-dark disabled:opacity-50">
          {pending ? '…' : 'Confirm deposit'}
        </button>
      </form>

      <div className="border border-ink/10 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-sand">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Booking</th>
              <th className="text-left px-4 py-2 font-medium">Amount</th>
              <th className="text-left px-4 py-2 font-medium">Ref</th>
              <th className="text-left px-4 py-2 font-medium">Confirmed</th>
              <th className="text-right px-4 py-2 font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {deposits.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-soft text-sm">No deposits yet.</td></tr>
            )}
            {deposits.map((d) => (
              <tr key={d.id} className="hover:bg-sand/40">
                <td className="px-4 py-2 font-mono text-xs">{d.booking_id}</td>
                <td className="px-4 py-2">{d.amount.toFixed(2)} {d.currency}</td>
                <td className="px-4 py-2 text-xs text-ink-soft">{d.reference ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-ink-soft">
                  {d.confirmed_at ? new Date(d.confirmed_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => revoke(d.booking_id)}
                    disabled={pending}
                    className="text-xs text-danger hover:underline"
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
