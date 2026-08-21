'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { acknowledgeSection } from '@/app/(portal)/sign/_actions/checklist';
import { t } from '@/lib/i18n';
import type { GuideSection } from '@/lib/guide/content';

type Group = {
  key: string;
  title: string;
  sections: GuideSection[];
};

type Props = {
  groups: Group[];
  ackMap: Record<string, boolean>;
  nextHref: string;
};

export function ReadingView({ groups, ackMap: initialAckMap, nextHref }: Props) {
  const router = useRouter();
  const [ackMap, setAckMap] = useState<Record<string, boolean>>(initialAckMap);
  const [pending, startTransition] = useTransition();
  const i18n = t('en');

  const totalSections = groups.reduce((n, g) => n + g.sections.length, 0);
  const ackedCount = Object.values(ackMap).filter(Boolean).length;
  const allAcked = ackedCount === totalSections;

  const toggle = (key: string, current: boolean) => {
    const next = !current;
    setAckMap((m) => ({ ...m, [key]: next }));
    startTransition(async () => {
      try {
        await acknowledgeSection({ section_key: key, acknowledged: next });
      } catch {
        setAckMap((m) => ({ ...m, [key]: current }));
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/10 rounded-lg p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="text-ink-soft">Progress</span>
          <span className="font-medium text-ink">{ackedCount} / {totalSections}</span>
        </div>
        <div className="mt-2 h-2 bg-ink/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-success transition-all"
            style={{ width: `${(ackedCount / totalSections) * 100}%` }}
          />
        </div>
      </div>

      {groups.map((g) => (
        <details key={g.key} open className="bg-white border border-ink/10 rounded-lg overflow-hidden">
          <summary className="px-6 py-4 bg-sand cursor-pointer list-none flex items-center justify-between">
            <h2 className="font-display text-xl text-ink">{g.title}</h2>
            <span className="text-xs text-ink-soft">
              {g.sections.filter((s) => ackMap[s.key]).length} / {g.sections.length}
            </span>
          </summary>

          <div className="p-6 space-y-8">
            {g.sections.map((s) => (
              <SectionBlock
                key={s.key}
                section={s}
                acknowledged={!!ackMap[s.key]}
                onToggle={() => toggle(s.key, !!ackMap[s.key])}
                disabled={pending}
              />
            ))}
          </div>
        </details>
      ))}

      <div className="sticky bottom-0 -mx-6 px-6 py-4 bg-gradient-to-t from-sand via-sand to-transparent">
        <button
          type="button"
          onClick={() => router.push(nextHref)}
          disabled={!allAcked || pending}
          className="w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {allAcked ? i18n.common.continue : `Continue (${ackedCount}/${totalSections} read)`}
        </button>
      </div>
    </div>
  );
}

function SectionBlock({ section, acknowledged, onToggle, disabled }: {
  section: GuideSection;
  acknowledged: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const i18n = t('en');

  return (
    <article className="border-l-2 border-ink/10 pl-5">
      <header className="mb-3">
        <h3 className="font-display text-2xl text-ink mb-1">
          {section.critical && <span className="text-danger mr-2">⚠</span>}
          {section.title}
        </h3>
        {section.estimated_minutes && (
          <div className="text-xs text-ink-soft">
            {i18n.reading.estMin.replace('{n}', String(section.estimated_minutes))}
          </div>
        )}
      </header>

      {section.warning && (
        <div className="mb-4 p-4 bg-danger/10 border-l-4 border-danger rounded text-sm text-ink">
          {section.warning}
        </div>
      )}

      {section.callout && (
        <div className="mb-4 p-4 bg-terracotta/10 border-l-4 border-terracotta rounded text-sm text-ink">
          {section.callout}
        </div>
      )}

      {section.paragraphs?.map((p, i) => (
        <p key={i} className="text-ink leading-relaxed mb-3">{p}</p>
      ))}

      {section.subheadings?.map((sh, i) => (
        <div key={i} className="mb-4">
          {sh.title && <h4 className="font-medium text-ink mb-2">{sh.title}</h4>}
          {sh.table && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-sand">
                    {sh.table.headers.map((h, j) => (
                      <th key={j} className="text-left px-3 py-2 border border-ink/10 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sh.table.rows.map((row, j) => (
                    <tr key={j} className="hover:bg-sand/50">
                      {row.map((cell, k) => (
                        <td key={k} className="px-3 py-2 border border-ink/10 align-top">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {sh.footnote && <p className="text-xs text-ink-soft mt-2 italic">{sh.footnote}</p>}
        </div>
      ))}

      {section.reminders && (
        <ul className="list-disc pl-5 mb-4 space-y-1">
          {section.reminders.map((r, i) => <li key={i} className="text-ink">{r}</li>)}
        </ul>
      )}

      {section.checklist_grouped?.map((g, i) => (
        <div key={i} className="mb-3">
          <div className="text-xs uppercase tracking-wider text-ink-soft mb-1">{g.group}</div>
          <ul className="list-disc pl-5 space-y-1">
            {g.items.map((item, j) => <li key={j} className="text-ink text-sm">{item}</li>)}
          </ul>
        </div>
      ))}

      <label className="flex items-center gap-3 mt-4 p-3 bg-sand rounded cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={onToggle}
          disabled={disabled}
          className="w-5 h-5 accent-terracotta"
        />
        <span className="text-sm font-medium text-ink">{i18n.reading.readAndUnderstood}</span>
        {acknowledged && <span className="ml-auto text-xs text-success font-medium">✓ Acknowledged</span>}
      </label>
    </article>
  );
}
