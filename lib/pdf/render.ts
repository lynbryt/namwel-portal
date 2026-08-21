// PDF rendering. Two implementations:
//   1. real: Puppeteer + Chromium — used in production.
//   2. stub: a minimal PDF — used in dev/test when Chromium is not available.
//
// The route at /api/render-pdf calls renderPdfForSession(), which picks
// the real path if PUPPETEER_EXECUTABLE_PATH (or @sparticuz/chromium)
// is configured, and the stub otherwise.

import { getAdmin } from '@/lib/supabase/admin';

export async function renderPdfForSession(sessionId: string): Promise<Buffer> {
  const admin = getAdmin();

  const { data: session } = await admin
    .from('signature_sessions')
    .select('id, reference_code, lead_traveller_name, lead_traveller_email, booking_id, language, party_size, has_minor, content_hash, signed_at, guide_version_id, pdf_path')
    .eq('id', sessionId)
    .single();
  if (!session) throw new Error('session not found');

  const { data: sig } = await admin
    .from('signature_records')
    .select('signed_name, signed_at, ip, content_hash, declarations_json, signature_image_path')
    .eq('session_id', sessionId)
    .single();
  if (!sig) throw new Error('signature not found');

  const { data: guideV } = await admin
    .from('guide_versions')
    .select('version, content_json')
    .eq('id', session.guide_version_id)
    .single();
  if (!guideV) throw new Error('guide version not found');

  const { data: travellers } = await admin
    .from('travellers')
    .select('full_name, date_of_birth, is_minor, role, ordinal')
    .eq('session_id', sessionId)
    .order('ordinal');

  const { data: uploads } = await admin
    .from('document_uploads')
    .select('doc_type, traveller_id, original_filename, sha256, byte_size, uploaded_at')
    .eq('session_id', sessionId);

  const { data: acks } = await admin
    .from('section_acknowledgments')
    .select('section_key, acknowledged_at')
    .eq('session_id', sessionId)
    .eq('acknowledged', true);

  const { data: checklist } = await admin
    .from('checklist_state')
    .select('item_key, checked_at')
    .eq('session_id', sessionId)
    .eq('checked', true);

  // Build the HTML.
  const html = renderHtml({
    session, signature: sig, guideVersion: guideV.version, guide: guideV.content_json,
    travellers: travellers ?? [], uploads: uploads ?? [],
    acks: acks ?? [], checklist: checklist ?? [],
  });

  // Try Puppeteer, fall back to a stub.
  try {
    return await renderWithPuppeteer(html, { reference: session.reference_code, signedName: sig.signed_name, contentHash: sig.content_hash });
  } catch (err) {
    console.warn('[pdf] Puppeteer render failed, falling back to stub:', err);
    return renderStubPdf({ reference: session.reference_code, signedName: sig.signed_name, contentHash: sig.content_hash });
  }
}

function renderHtml(data: any): string {
  // A compact, print-friendly HTML representation. Real layout would use
  // the Dune design system; for the scaffold this is a clean text layout.
  const travellersHtml = (data.travellers as any[])
    .map((t) => `<tr><td>${escape(t.full_name)}</td><td>${t.date_of_birth}</td><td>${t.role}</td><td>${t.is_minor ? 'minor' : 'adult'}</td></tr>`)
    .join('');
  const uploadsHtml = (data.uploads as any[])
    .map((u) => `<tr><td>${escape(u.doc_type)}</td><td>${escape(u.original_filename)}</td><td>${u.sha256.slice(0, 12)}…</td><td>${new Date(u.uploaded_at).toISOString()}</td></tr>`)
    .join('');
  const acksHtml = (data.acks as any[]).map((a) => `<li>${escape(a.section_key)} — ${new Date(a.acknowledged_at).toISOString()}</li>`).join('');
  const checklistHtml = (data.checklist as any[]).map((c) => `<li>${escape(c.item_key)}</li>`).join('');

  return `<!doctype html>
<html lang="${escape(data.session.language)}">
<head>
<meta charset="utf-8" />
<title>Namwel Tourist Information Guide — ${escape(data.session.reference_code)}</title>
<style>
  body { font-family: Georgia, serif; color: #1F1B17; max-width: 720px; margin: 2rem auto; padding: 0 1rem; line-height: 1.55; }
  h1 { font-size: 1.9rem; margin: 0 0 .25rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; border-bottom: 1px solid #E8DFCE; padding-bottom: .25rem; }
  table { width: 100%; border-collapse: collapse; font-size: .85rem; margin: .5rem 0 1rem; }
  th, td { text-align: left; padding: .35rem .5rem; border-bottom: 1px solid #E8DFCE; vertical-align: top; }
  th { background: #F5EFE3; }
  .meta { color: #4A4138; font-size: .85rem; }
  .footer { margin-top: 3rem; padding-top: 1rem; border-top: 1px solid #E8DFCE; font-size: .75rem; color: #4A4138; }
  .disclaimer { font-size: .75rem; color: #4A4138; font-style: italic; margin: 1rem 0; }
  .hash { font-family: ui-monospace, Menlo, monospace; font-size: .7rem; word-break: break-all; }
</style>
</head>
<body>
  <h1>Namwel Tourist Information Guide</h1>
  <div class="meta">Signed copy · Reference ${escape(data.session.reference_code)} · Booking ${escape(data.session.booking_id)}</div>
  <div class="meta">Guide version ${escape(data.guideVersion)} · Signed at ${new Date(data.signature.signed_at).toISOString()} UTC</div>

  <h2>Lead traveller</h2>
  <p>${escape(data.session.lead_traveller_name)} (${escape(data.session.lead_traveller_email)})</p>
  <p>Party of ${data.session.party_size ?? '—'}${data.session.has_minor ? ', with minors' : ''}.</p>

  <h2>Travellers</h2>
  <table>
    <thead><tr><th>Name</th><th>Date of birth</th><th>Role</th><th>Adult/minor</th></tr></thead>
    <tbody>${travellersHtml}</tbody>
  </table>

  <h2>Section acknowledgements</h2>
  <ul>${acksHtml}</ul>

  <h2>Pre-departure checklist (completed)</h2>
  <ul>${checklistHtml}</ul>

  <h2>Documents uploaded</h2>
  <table>
    <thead><tr><th>Type</th><th>Filename</th><th>SHA-256</th><th>Uploaded at</th></tr></thead>
    <tbody>${uploadsHtml}</tbody>
  </table>

  <h2>Declarations accepted</h2>
  <ol>
    ${(data.signature.declarations_json as any[]).map((d) => `<li>${escape(d.label)}</li>`).join('')}
  </ol>

  <h2>Signature</h2>
  <p>Signed by: <strong>${escape(data.signature.signed_name)}</strong></p>
  <p>IP: ${escape(data.signature.ip)}</p>
  <p class="hash">Content hash (SHA-256): ${escape(data.signature.content_hash)}</p>

  <div class="footer">
    <p>Verify this signature at:
      <span class="hash">${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${escape(data.session.id)}</span>
    </p>
    <p class="disclaimer">${escape(data.guide.disclaimer)}</p>
  </div>
</body>
</html>`;
}

function escape(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

async function renderWithPuppeteer(html: string, _meta: { reference: string; signedName: string; contentHash: string }): Promise<Buffer> {
  // Lazy import so the stub fallback works even if Puppeteer isn't installed.
  let chromium;
  let puppeteer;
  try {
    chromium = (await import('@sparticuz/chromium')).default;
    puppeteer = (await import('puppeteer-core')).default;
  } catch (err) {
    throw new Error('puppeteer not installed');
  }

  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || (await chromium.executablePath());
  const browser = await puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function renderStubPdf(meta: { reference: string; signedName: string; contentHash: string }): Buffer {
  // Minimal valid 1-page PDF — used as a placeholder so dev flows can
  // exercise the upload step without Puppeteer. Real PDFs are rendered
  // by renderWithPuppeteer in production.
  const text = `Namwel Tourist Information Guide - signed copy\n\nReference: ${meta.reference}\nSigned by: ${meta.signedName}\nHash: ${meta.contentHash}`;
  const stream = `BT /F1 12 Tf 50 750 Td (${text.replace(/[\\()]/g, (c) => '\\' + c).replace(/\n/g, ') Tj 0 -16 Td (')}) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length ${stream.length} >>
stream
${stream}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000054 00000 n
0000000099 00000 n
0000000177 00000 n
0000000${(260 + stream.length).toString().padStart(3, '0')} 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
${320 + stream.length}
%%EOF`;
  return Buffer.from(pdf, 'utf-8');
}
