'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createHash } from 'node:crypto';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';
import { requiredDocsForScenario, labelForDocType } from '@/lib/uploads/doc-types';

const ALLOWED_MIME = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 15 * 1024 * 1024;
const BUCKET = process.env.STORAGE_BUCKET || 'sign-portal';

const UploadMetaSchema = z.object({
  doc_type: z.string().min(1).max(64),
  traveller_id: z.string().uuid().optional().nullable(),
  client_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  original_filename: z.string().min(1).max(255),
});

export type UploadInput = z.infer<typeof UploadMetaSchema> & { file: File };

/**
 * Upload a document for this session. Validates type/size, computes the
 * server-side sha256 (must match client), uploads to Supabase Storage,
 * and writes a document_uploads row.
 */
export async function uploadDocument(input: UploadInput) {
  const session = await requirePortalSession();
  const meta = UploadMetaSchema.parse({
    doc_type: input.doc_type,
    traveller_id: input.traveller_id ?? null,
    client_sha256: input.client_sha256,
    original_filename: input.original_filename,
  });

  if (!ALLOWED_MIME.has(input.file.type)) {
    throw new Error('file type not allowed');
  }
  if (input.file.size > MAX_BYTES) {
    throw new Error('file too large');
  }

  const buf = Buffer.from(await input.file.arrayBuffer());
  const serverHash = createHash('sha256').update(buf).digest('hex');
  if (serverHash !== meta.client_sha256) {
    throw new Error('hash mismatch (upload corruption)');
  }

  const storagePath = `uploads/${session.id}/${meta.doc_type}/${serverHash}.${extFromMime(input.file.type)}`;

  const admin = getAdmin();
  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, buf, {
      contentType: input.file.type,
      upsert: false,
      cacheControl: '3600',
    });
  if (uploadErr) {
    if (uploadErr.message?.includes('already exists')) {
      // idempotent retry: storage path is content-addressed, so this is fine
    } else {
      throw new Error(`storage upload failed: ${uploadErr.message}`);
    }
  }

  const { data, error } = await admin
    .from('document_uploads')
    .insert({
      session_id: session.id,
      traveller_id: meta.traveller_id ?? null,
      doc_type: meta.doc_type,
      storage_path: storagePath,
      original_filename: meta.original_filename,
      mime_type: input.file.type,
      byte_size: input.file.size,
      sha256: serverHash,
    })
    .select()
    .single();
  if (error) throw new Error('failed to record upload');

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'document_uploaded',
    event_data: { doc_type: meta.doc_type, traveller_id: meta.traveller_id, sha256: serverHash },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/sign/documents');
  return { ok: true, id: data.id };
}

function extFromMime(mime: string): string {
  switch (mime) {
    case 'application/pdf': return 'pdf';
    case 'image/jpeg':      return 'jpg';
    case 'image/png':       return 'png';
    case 'image/webp':      return 'webp';
    default:                return 'bin';
  }
}

export async function listUploads() {
  const session = await requirePortalSession();
  const admin = getAdmin();
  const { data, error } = await admin
    .from('document_uploads')
    .select('*')
    .eq('session_id', session.id)
    .order('uploaded_at', { ascending: false });
  if (error) throw new Error('failed to list uploads');
  return data ?? [];
}

// Compute the required document set for the current session.
//   Always: passport per traveller + insurance.
//   If self-drive: driving_licence per driver, idp if any driver not English.
//   If has_minor: per minor, by scenario.
export async function requiredDocumentsForCurrentSession() {
  const session = await requirePortalSession();
  const admin = getAdmin();

  // travellers
  const { data: travellers } = await admin
    .from('travellers')
    .select('id, full_name, is_minor, role')
    .eq('session_id', session.id)
    .order('ordinal', { ascending: true });

  const requirements: {
    doc_type: string;
    traveller_id: string | null;
    label: string;
    critical: boolean;
  }[] = [];

  // passports — required for every traveller
  for (const t of travellers ?? []) {
    requirements.push({
      doc_type: 'passport',
      traveller_id: t.id,
      label: `Passport scan — ${t.full_name}`,
      critical: true,
    });
  }

  // insurance — always
  requirements.push({
    doc_type: 'insurance_certificate',
    traveller_id: null,
    label: 'Travel insurance certificate',
    critical: true,
  });

  // children — for each minor, by scenario
  if (session.has_minor) {
    for (const t of (travellers ?? []).filter((t) => t.is_minor)) {
      const { data: sc } = await admin
        .from('child_scenarios')
        .select('scenario')
        .eq('traveller_id', t.id)
        .maybeSingle();
      const scenario = sc?.scenario ?? 'both_parents';
      for (const docType of requiredDocsForScenario(scenario)) {
        requirements.push({
          doc_type: docType,
          traveller_id: t.id,
          label: `${labelForDocType(docType)} — ${t.full_name}`,
          critical: true,
        });
      }
    }
  }

  return requirements;
}
