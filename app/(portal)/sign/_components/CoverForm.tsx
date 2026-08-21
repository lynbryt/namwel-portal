'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setParty } from '@/app/(portal)/sign/_actions/session';
import { t } from '@/lib/i18n';

type Props = {
  defaultPartySize: number;
  defaultHasMinor: boolean;
};

export function CoverForm({ defaultPartySize, defaultHasMinor }: Props) {
  const router = useRouter();
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [hasMinor, setHasMinor] = useState(defaultHasMinor);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const i18n = t('en');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await setParty({ party_size: partySize, has_minor: hasMinor });
        router.push('/sign/reading');
      } catch (err: any) {
        setError(err?.message ?? i18n.common.error);
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-7">
      <div>
        <label className="block text-sm font-medium text-ink mb-3">
          {i18n.sign.partySizeLabel}
        </label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPartySize((n) => Math.max(1, n - 1))}
            className="w-10 h-10 rounded-full border border-ink/20 text-ink hover:bg-sand"
            aria-label="decrease"
          >−</button>
          <div className="text-3xl font-display text-ink w-12 text-center">{partySize}</div>
          <button
            type="button"
            onClick={() => setPartySize((n) => Math.min(20, n + 1))}
            className="w-10 h-10 rounded-full border border-ink/20 text-ink hover:bg-sand"
            aria-label="increase"
          >+</button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink mb-3">
          {i18n.sign.hasMinorLabel}
        </label>
        <p className="text-xs text-ink-soft mb-3">{i18n.sign.hasMinorHelp}</p>
        <div className="grid grid-cols-2 gap-3">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setHasMinor(v)}
              className={`px-4 py-3 rounded border text-sm font-medium transition-colors ${
                hasMinor === v
                  ? 'bg-terracotta text-white border-terracotta'
                  : 'bg-white text-ink border-ink/20 hover:border-ink/40'
              }`}
            >
              {v ? i18n.common.yes : i18n.common.no}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded px-4 py-3">{error}</div>}

      <button
        type="submit"
        disabled={pending}
        className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark disabled:opacity-50"
      >
        {pending ? i18n.common.saving : i18n.common.continue}
      </button>
    </form>
  );
}
