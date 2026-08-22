'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitSignature } from '@/app/(portal)/sign/_actions/submit';
import { t } from '@/lib/i18n';

type Declaration = { key: string; label: string };
type Props = { leadName: string; leadEmail: string; declarations: Declaration[] };

export function SignView({ leadName, declarations }: Props) {
  const router = useRouter();
  const i18n = t('en');
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [typedName, setTypedName] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasSignature, setHasSignature] = useState(false);
  const [strokes, setStrokes] = useState(0);

  // Initialise canvas.
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1F1B17';
  }, []);

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
    setStrokes(0);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const rect = c.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    c.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!(e.buttons & 1)) return;
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    const rect = c.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
    setHasSignature(true);
    setStrokes((s) => s + 1);
  };

  const allAccepted = declarations.every((d) => accepted[d.key]);
  const nameMatches = typedName.trim().toLowerCase() === leadName.trim().toLowerCase();

  const canSubmit = allAccepted && hasSignature && strokes >= 20 && nameMatches && !pending;

  const submit = () => {
    setError(null);
    const c = canvasRef.current;
    if (!c) return;
    const dataUrl = c.toDataURL('image/png');
    // Strip "data:image/png;base64,"
    const base64 = dataUrl.split(',')[1] ?? '';

    startTransition(async () => {
      try {
        await submitSignature({
          signed_name: typedName.trim(),
          signature_png_base64: base64,
          declarations: declarations.map((d) => ({ key: d.key, label: d.label, accepted: !!accepted[d.key] })),
        });
        router.push('/sign/done');
      } catch (err: any) {
        setError(err?.message ?? i18n.common.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-ink/10 rounded-lg p-6 md:p-8">
        <h2 className="font-display text-xl text-ink mb-4">{i18n.sign_.declarations}</h2>
        <div className="space-y-3">
          {declarations.map((d) => (
            <label key={d.key} className="flex items-start gap-3 p-3 border border-ink/10 rounded cursor-pointer hover:bg-sand/40">
              <input
                type="checkbox"
                checked={!!accepted[d.key]}
                onChange={(e) => setAccepted((a) => ({ ...a, [d.key]: e.target.checked }))}
                className="mt-1 w-5 h-5 accent-terracotta"
              />
              <span className="text-sm text-ink leading-relaxed">{d.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white border border-ink/10 rounded-lg p-6 md:p-8">
        <h2 className="font-display text-xl text-ink mb-4">{i18n.sign_.drawSignature}</h2>
        <div className="border-2 border-dashed border-ink/20 rounded bg-sand/50">
          <canvas
            ref={canvasRef}
            className="w-full h-48 touch-none cursor-crosshair"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-ink-soft">
          <span>{hasSignature ? `${strokes} strokes` : 'Sign with your finger or mouse'}</span>
          <button type="button" onClick={clearCanvas} className="underline hover:text-terracotta">{i18n.sign_.clear}</button>
        </div>
      </div>

      <div className="bg-white border border-ink/10 rounded-lg p-6 md:p-8">
        <label className="block text-sm font-medium text-ink mb-2">{i18n.sign_.typeName}</label>
        <p className="text-xs text-ink-soft mb-3">
          Lead traveller: <span className="font-medium text-ink">{leadName}</span>. {i18n.sign_.nameHelp}
        </p>
        <input
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={leadName}
          className={`w-full px-4 py-3 border rounded text-base font-medium ${
            typedName && !nameMatches ? 'border-danger' : 'border-ink/20'
          }`}
        />
        {typedName && !nameMatches && (
          <p className="text-xs text-danger mt-1">{i18n.sign_.nameMismatch}</p>
        )}
      </div>

      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger text-sm rounded px-4 py-3">{error}</div>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full bg-terracotta text-white font-medium py-4 rounded hover:bg-terracotta-dark disabled:opacity-40 disabled:cursor-not-allowed text-base"
      >
        {pending ? i18n.common.saving : i18n.sign_.signAndSubmit}
      </button>

      <p className="text-[10px] text-ink-soft text-center leading-relaxed">
        By signing, you agree that the typed name, drawn signature, server timestamp, IP address and content hash together constitute your electronic signature under the Namibia ECT Act 4 of 2009.
      </p>
    </div>
  );
}
