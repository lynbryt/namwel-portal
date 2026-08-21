'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { heartbeat } from '@/app/(portal)/sign/_actions/session';

const STEPS = [
  { key: 'cover',     label: 'Cover' },
  { key: 'reading',   label: 'Read' },
  { key: 'children',  label: 'Children' },
  { key: 'checklist', label: 'Checklist' },
  { key: 'documents', label: 'Documents' },
  { key: 'sign',      label: 'Sign' },
];

type Props = {
  current: string;
  hasMinor: boolean;
  children: React.ReactNode;
};

export function WizardShell({ current, hasMinor, children }: Props) {
  const router = useRouter();
  const [savedLabel, setSavedLabel] = useState<string>('Saved');

  useEffect(() => {
    // 30s heartbeat keeps the session alive.
    const t = setInterval(() => {
      heartbeat()
        .then(() => setSavedLabel('Saved'))
        .catch(() => setSavedLabel('Save failed'));
    }, 30_000);
    return () => clearInterval(t);
  }, []);

  // Exit guard.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const visibleSteps = hasMinor
    ? STEPS
    : STEPS.filter((s) => s.key !== 'children');

  const currentIndex = visibleSteps.findIndex((s) => s.key === current);

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-ink/10 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="font-display text-lg text-ink">Namwel</div>
            <div className="text-xs text-ink-soft hidden sm:block">Tourist Information Guide</div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-ink-soft">{savedLabel}</span>
            <button
              onClick={() => router.push('/api/logout')}
              className="text-xs text-ink-soft hover:text-terracotta underline"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="max-w-5xl mx-auto px-6 pb-4 flex items-center gap-2">
          {visibleSteps.map((s, i) => {
            const state = i < currentIndex ? 'done' : i === currentIndex ? 'current' : 'future';
            return (
              <div key={s.key} className="flex-1">
                <div className="h-1 rounded-full bg-ink/10 overflow-hidden">
                  <motion.div
                    className={state === 'done' ? 'h-full bg-success' : state === 'current' ? 'h-full bg-terracotta' : 'h-full bg-transparent'}
                    initial={{ width: 0 }}
                    animate={{ width: state === 'future' ? '0%' : '100%' }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <div className={`mt-1 text-[10px] uppercase tracking-wider ${
                  state === 'current' ? 'text-terracotta font-medium' : state === 'done' ? 'text-success' : 'text-ink-soft'
                }`}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <motion.div
          key={current}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
