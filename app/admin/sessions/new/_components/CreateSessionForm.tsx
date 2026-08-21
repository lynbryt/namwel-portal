'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createSigningSession, type CreateSessionResult } from '../../_actions';

export function CreateSessionForm() {
  const [bookingId, setBookingId] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [hasMinor, setHasMinor] = useState(false);
  const [confirmDeposit, setConfirmDeposit] = useState(true);
  const [depositAmount, setDepositAmount] = useState<number | ''>('');
  const [depositReference, setDepositReference] = useState('');
  const [windowDays, setWindowDays] = useState(30);

  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateSessionResult | null>(null);
  const [copied, setCopied] = useState<'ref' | 'pwd' | 'both' | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setCopied(null);

    startTransition(async () => {
      const result = await createSigningSession({
        booking_id: bookingId,
        lead_traveller_name: leadName,
        lead_traveller_email: leadEmail,
        party_size: partySize,
        has_minor: hasMinor,
        confirm_deposit: confirmDeposit,
        deposit_amount: depositAmount === '' ? null : Number(depositAmount),
        deposit_reference: depositReference || null,
        deposit_currency: 'NAD',
        window_days: windowDays,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(result);
    });
  };

  const copy = async (text: string, what: 'ref' | 'pwd') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // ignore
    }
  };

  if (success?.ok) {
    return (
      <div className="space-y-6">
        <div className="bg-success/10 border border-success/30 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success text-xl">✓</div>
            <div>
              <h2 className="font-display text-xl text-ink">Signing session created</h2>
              <p className="text-ink-soft text-sm">Send these credentials to the lead traveller. The password cannot be recovered later.</p>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <CredentialRow
              label="Reference number"
              value={success.reference_code}
              onCopy={() => copy(success.reference_code, 'ref')}
              copied={copied === 'ref'}
            />
            <CredentialRow
              label="One-time password"
              value={success.password}
              onCopy={() => copy(success.password, 'pwd')}
              copied={copied === 'pwd'}
            />
            <div className="text-xs text-ink-soft">
              Send these to <span className="font-mono">{success.lead_traveller_email}</span> via your usual channel (EmailJS will replace this once configured).
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/signings/${success.id}`}
            className="px-5 py-2 bg-ink text-white text-sm rounded hover:bg-ink-soft"
          >
            View session detail →
          </Link>
          <button
            onClick={() => {
              setSuccess(null);
              setBookingId('');
              setLeadName('');
              setLeadEmail('');
              setDepositAmount('');
              setDepositReference('');
            }}
            className="px-5 py-2 bg-white border border-ink/20 text-ink text-sm rounded hover:bg-sand"
          >
            Create another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Section title="Booking">
        <Field label="Booking ID" hint="Free-text reference, e.g. TR-2026-0042 or just the invoice number">
          <input
            value={bookingId}
            onChange={(e) => setBookingId(e.target.value)}
            required
            className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            placeholder="TR-2026-0042"
          />
        </Field>
      </Section>

      <Section title="Lead traveller">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Full name">
            <input
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
              required
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
              placeholder="Jane Smith"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={leadEmail}
              onChange={(e) => setLeadEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
              placeholder="[email protected]"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <Field label="Party size">
            <input
              type="number"
              min={1}
              max={20}
              value={partySize}
              onChange={(e) => setPartySize(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            />
          </Field>
          <Field label="Signing window (days)">
            <input
              type="number"
              min={1}
              max={365}
              value={windowDays}
              onChange={(e) => setWindowDays(Math.max(1, Math.min(365, Number(e.target.value) || 30)))}
              className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
            />
          </Field>
        </div>
        <label className="flex items-center gap-2 mt-4 text-sm">
          <input
            type="checkbox"
            checked={hasMinor}
            onChange={(e) => setHasMinor(e.target.checked)}
            className="w-4 h-4 accent-terracotta"
          />
          <span>Anyone in the party is under 18</span>
        </label>
      </Section>

      <Section title="Deposit">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={confirmDeposit}
            onChange={(e) => setConfirmDeposit(e.target.checked)}
            className="w-4 h-4 accent-terracotta"
          />
          <span>Confirm a deposit for this booking now (creates a confirmed deposit row)</span>
        </label>
        {confirmDeposit && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <Field label="Amount (NAD)">
              <input
                type="number"
                step="0.01"
                min={0}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value === '' ? '' : Number(e.target.value))}
                required={confirmDeposit}
                className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
                placeholder="5000.00"
              />
            </Field>
            <Field label="Reference (bank txn)">
              <input
                value={depositReference}
                onChange={(e) => setDepositReference(e.target.value)}
                className="w-full px-3 py-2 border border-ink/20 rounded text-sm"
                placeholder="TRX-2026-0421"
              />
            </Field>
            <Field label="Currency" hint="NAD for Namibian Dollar">
              <input
                value="NAD"
                readOnly
                className="w-full px-3 py-2 border border-ink/20 rounded text-sm bg-sand text-ink-soft"
              />
            </Field>
          </div>
        )}
        {!confirmDeposit && (
          <p className="text-xs text-ink-soft mt-2">
            Leave unchecked only if a confirmed deposit row already exists for this booking. The session is only created if a confirmed deposit is on file (per spec decision 7).
          </p>
        )}
      </Section>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded px-4 py-3">{error}</div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="px-6 py-3 bg-terracotta text-white font-medium rounded hover:bg-terracotta-dark disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create signing session'}
        </button>
        <Link href="/admin" className="text-sm text-ink-soft hover:text-terracotta">Cancel</Link>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-ink-soft border-b border-ink/10 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs text-ink-soft mb-1">{label}</div>
      {children}
      {hint && <div className="text-[10px] text-ink-soft mt-1">{hint}</div>}
    </label>
  );
}

function CredentialRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="bg-white border border-ink/10 rounded p-4">
      <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <code className="flex-1 font-mono text-lg text-ink break-all bg-sand px-3 py-2 rounded">{value}</code>
        <button
          onClick={onCopy}
          className="px-3 py-1.5 bg-ink text-white text-xs font-medium rounded hover:bg-ink-soft whitespace-nowrap"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
