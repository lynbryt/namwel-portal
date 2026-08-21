// PDF render route. Triggered after submit.
// In production this would use Puppeteer + Chromium. For this buildable
// scaffold we stub the render and write a placeholder file. The integration
// with Puppeteer is documented in /lib/pdf/render.ts and uncommented in
// the production deployment step.

import { NextRequest, NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get('session_id');
  if (!sessionId) {
    return NextResponse.json({ error: 'missing session_id' }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: session } = await admin
    .from('signature_sessions')
    .select('id, status, lead_traveller_name, reference_code, pdf_path, content_hash')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (session.status !== 'signed') {
    return NextResponse.json({ error: 'session not signed' }, { status: 409 });
  }

  // Render the PDF.
  // The full Puppeteer integration is in /lib/pdf/render.ts. For this
  // buildable scaffold we generate a minimal placeholder PDF; the real
  // render will replace this in production.
  const { renderPdfForSession } = await import('@/lib/pdf/render');
  const pdfBuffer = await renderPdfForSession(sessionId);

  // Upload to storage.
  const pdfPath = `signed/${sessionId}/guide.pdf`;
  const { error: uploadErr } = await admin.storage
    .from(process.env.STORAGE_BUCKET || 'sign-portal')
    .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  await admin
    .from('signature_sessions')
    .update({ pdf_path: pdfPath })
    .eq('id', sessionId);

  await logAudit({
    session_id: sessionId,
    actor: 'system',
    event_type: 'pdf_rendered',
    event_data: { path: pdfPath, bytes: pdfBuffer.length },
  });

  return NextResponse.json({ ok: true, path: pdfPath, bytes: pdfBuffer.length });
}
