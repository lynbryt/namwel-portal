'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';

type Props = {
  referenceCode: string;
  signedAt: string;
  contentHash: string;
  sessionId: string;
  initialPdfPath: string | null;
  copy: {
    title: string;
    body: string;
    download: string;
    contact: string;
    generating: string;
    stillGenerating: string;
  };
};

export function DoneView({
  referenceCode,
  signedAt,
  contentHash,
  sessionId,
  initialPdfPath,
  copy,
}: Props) {
  const [pdfPath, setPdfPath] = useState<string | null>(initialPdfPath);
  const [tick, setTick] = useState(0); // for the "still waiting" message
  const [error, setError] = useState<string | null>(null);
  const triggeredRef = useRef(false);

  // Trigger the render once on mount if pdf_path is null.
  useEffect(() => {
    if (pdfPath || triggeredRef.current) return;
    triggeredRef.current = true;

    const trigger = async () => {
      try {
        const res = await fetch(`/api/render-pdf?session_id=${sessionId}`, {
          method: 'POST',
        });
        if (!res.ok && res.status !== 409) {
          // 409 = "session not signed" is fine if the previous submit
          // already triggered it.
          console.warn('[done] render trigger non-ok', res.status);
        }
      } catch (err) {
        console.error('[done] render trigger failed', err);
      }
    };

    trigger();
  }, [pdfPath, sessionId]);

  // Poll every 3s until pdf_path is set.
  useEffect(() => {
    if (pdfPath) return;
    const id = setInterval(() => setTick((t) => t + 1), 3000);
    return () => clearInterval(id);
  }, [pdfPath]);

  // When tick advances, ask the server for the latest status.
  useEffect(() => {
    if (pdfPath || tick === 0) return;
    const check = async () => {
      try {
        const res = await fetch(`/api/render-pdf?session_id=${sessionId}`, {
          method: 'GET',
        });
        if (res.ok) {
          const j = await res.json();
          if (j.path) setPdfPath(j.path);
        } else if (res.status === 409) {
          // still rendering, just keep waiting
        } else {
          setError(`status ${res.status}`);
        }
      } catch (err: any) {
        setError(err?.message ?? 'network');
      }
    };
    check();
  }, [tick, pdfPath, sessionId]);

  // After 30s of waiting, show the "still generating" copy
  const showStill = tick >= 10; // ~30s

  return (
    <div className="bg-white border border-ink/10 rounded-lg p-8 md:p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-success/10 flex items-center justify-center">
        <svg className="w-8 h-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="font-display text-3xl text-ink mb-3">{copy.title}</h1>
      <p className="text-ink-soft text-sm leading-relaxed max-w-md mx-auto mb-8">{copy.body}</p>

      <div className="bg-sand rounded-lg p-4 mb-6 text-left text-xs font-mono space-y-1">
        <div><span className="text-ink-soft">Reference:</span> {referenceCode}</div>
        <div><span className="text-ink-soft">Signed:</span> {new Date(signedAt).toISOString()}</div>
        <div className="break-all"><span className="text-ink-soft">Hash:</span> {contentHash}</div>
      </div>

      <div className="space-y-3 max-w-sm mx-auto">
        {pdfPath ? (
          <a
            href={`/api/download-pdf?session_id=${sessionId}`}
            className="block w-full bg-terracotta text-white font-medium py-3 rounded hover:bg-terracotta-dark text-center"
          >
            {copy.download}
          </a>
        ) : (
          <div
            className="block w-full bg-terracotta/40 text-white font-medium py-3 rounded cursor-wait text-center"
            aria-busy="true"
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {showStill ? copy.stillGenerating : copy.generating}
            </span>
          </div>
        )}

        {error && !pdfPath && (
          <p className="text-xs text-danger">Render poll error: {error}</p>
        )}

        <p className="text-xs text-ink-soft pt-4 border-t border-ink/10">{copy.contact}</p>
      </div>
    </div>
  );
}
