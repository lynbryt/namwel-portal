// POST /api/upload-document
// Accepts multipart/form-data with fields:
//   file: File
//   doc_type: string
//   traveller_id: string (optional, "" if N/A)
//   client_sha256: string (64-char hex)
//   original_filename: string
//
// Returns { ok: true, id } on success or { error: '...' } on failure.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = process.env.STORAGE_BUCKET || 'sign-portal';

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requirePortalSession();
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid form data' }, { status: 400 });
  }

  const file = formData.get('file');
  const docType = String(formData.get('doc_type') ?? '');
  const travellerId = String(formData.get('traveller_id') ?? '') || null;
  const clientSha = String(formData.get('client_sha256') ?? '');
  const originalFilename = String(formData.get('original_filename') ?? '');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing file' }, { status: 400 });
  }
  if (!docType) {
    return NextResponse.json({ error: 'missing doc_type' }, { status: 400 });
  }
  if (!/^[a-f0-9]{64}$/.test(clientSha)) {
    return NextResponse.json({ error: 'invalid sha256' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'file type not allowed' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file too large' }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const serverHash = createHash('sha256').update(buf).digest('hex');
  if (serverHash !== clientSha) {
    return NextResponse.json({ error: 'hash mismatch (upload corruption)' }, { status: 400 });
  }

  const ext = file.type === 'application/pdf' ? 'pdf'
            : file.type === 'image/jpeg'      ? 'jpg'
            : file.type === 'image/png'       ? 'png'
            : file.type === 'image/webp'      ? 'webp'
            : 'bin';

  const storagePath = `uploads/${session.id}/${docType}/${serverHash}.${ext}`;

  const admin = getAdmin();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buf, { contentType: file.type, upsert: false, cacheControl: '3600' });
  // 'already exists' is fine — content-addressed path
  if (uploadErr && !uploadErr.message?.includes('already exists')) {
    return NextResponse.json({ error: `storage upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  const { data, error: dbErr } = await admin
    .from('document_uploads')
    .insert({
      session_id: session.id,
      traveller_id: travellerId,
      doc_type: docType,
      storage_path: storagePath,
      original_filename: originalFilename || file.name,
      mime_type: file.type,
      byte_size: file.size,
      sha256: serverHash,
    })
    .select()
    .single();

  if (dbErr) {
    return NextResponse.json({ error: `db insert failed: ${dbErr.message}` }, { status: 500 });
  }

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'document_uploaded',
    event_data: { doc_type: docType, traveller_id: travellerId, sha256: serverHash, byte_size: file.size },
    ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    user_agent: req.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true, id: data.id });
}
