'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toggleChecklistItem } from '@/app/(portal)/sign/_actions/checklist';
import { t } from '@/lib/i18n';

type Item = { key: string; group: string; label: string };
type Props = {
  items: Item[];
  groupLabels: Record<string, string>;
  initialState: Record<string, boolean>;
  nextHref: string;
};

export function ChecklistView({ items, groupLabels, initialState, nextHref }: Props) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [, startTransition] = useTransition();
  const i18n = t('en');

  const groups = Array.from(new Set(items.map((i) => i.group)));

  const toggle = (key: string, current: boolean) => {
    const next = !current;
    setState((s) => ({ ...s, [key]: next }));
    startTransition(async () => {
      try {
        await toggleChecklistItem({ item_key: key, checked: next });
      } catch {
        setState((s) => ({ ...s, [key]: current }));
      }
    });
  };

  const total = items.length;
  const done = items.filter((i) => state[i.key]).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/10 rounded-lg p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Completed</span>
          <span className="font-medium text-ink">{done} / {total}</span>
        </div>
        <div className="mt-2 h-2 bg-ink/10 rounded-full overflow-hidden">
          <div className="h-full bg-success transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      </div>

      {groups.map((g) => (
        <div key={g} className="bg-white border border-ink/10 rounded-lg overflow-hidden">
          <div className="bg-sand px-6 py-3">
            <h2 className="font-medium text-ink">{groupLabels[g] ?? g}</h2>
          </div>
          <ul className="divide-y divide-ink/10">
            {items.filter((i) => i.group === g).map((item) => (
              <li key={item.key}>
                <label className="flex items-start gap-3 px-6 py-4 cursor-pointer hover:bg-sand/40">
                  <input
                    type="checkbox"
                    checked={!!state[item.key]}
                    onChange={() => toggle(item.key, !!state[item.key])}
                    className="mt-1 w-5 h-5 accent-terracotta"
                  />
                  <span className={`text-sm leading-relaxed ${state[item.key] ? 'text-ink-soft line-through' : 'text-ink'}`}>
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <button
        onClick={() => router.push(nextHref)}
        className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark"
      >
        {i18n.common.continue}
      </button>
    </div>
  );
}
