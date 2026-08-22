'use server';

import { z } from 'zod';
import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';
import { requiredDocsForScenario, labelForDocType } from '@/lib/uploads/doc-types';

const SubmitSchema = z.object({
  signed_name: z.string().min(2).max(200),
  signature_png_base64: z.string().regex(/^[A-Za-z0-9+/=]+$/).max(500_000), // ~375KB encoded
  declarations: z.array(z.object({
    key: z.string(),
    label: z.string(),
    accepted: z.boolean(),
  })).length(5),
});

export type SubmitInput = z.infer<typeof SubmitSchema>;

/**
 * Canonical JSON for hashing. Order matters; we want a stable hash.
 * We use a recursive sorted-key serializer.
 */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonical(obj[k])).join(',') + '}';
}

export async function submitSignature(input: SubmitInput) {
  const session = await requirePortalSession();
  const parsed = SubmitSchema.parse(input);

  if (session.status === 'signed') {
    throw new Error('session already signed');
  }

  // Verify all 5 declarations accepted.
  if (parsed.declarations.length !== 5 || !parsed.declarations.every((d) => d.accepted)) {
    throw new Error('all 5 declarations must be accepted');
  }

  // Verify signed name matches lead traveller name (case-insensitive, trimmed).
  if (parsed.signed_name.trim().toLowerCase() !== session.lead_traveller_name.trim().toLowerCase()) {
    throw new Error('signed name does not match lead traveller name');
  }

  // Build the final payload from a single re-fetch.
  const admin = getAdmin();

  const { data: travellers } = await admin
    .from('travellers')
    .select('id, full_name, date_of_birth, is_minor, role, passport_number, passport_expiry, passport_country, ordinal')
    .eq('session_id', session.id)
    .order('ordinal', { ascending: true });

  const { data: scenarios } = await admin
    .from('child_scenarios')
    .select('traveller_id, scenario, non_travelling_parent_name, non_travelling_parent_id_last4, receiving_person_name, receiving_person_address, notes')
    .in('traveller_id', (travellers ?? []).filter((t) => t.is_minor).map((t) => t.id));

  const { data: uploads } = await admin
    .from('document_uploads')
    .select('id, doc_type, traveller_id, original_filename, sha256, byte_size, uploaded_at')
    .eq('session_id', session.id)
    .order('uploaded_at', { ascending: true });

  const { data: acks } = await admin
    .from('section_acknowledgments')
    .select('section_key, acknowledged, acknowledged_at')
    .eq('session_id', session.id);

  const { data: checklist } = await admin
    .from('checklist_state')
    .select('item_key, checked, checked_at')
    .eq('session_id', session.id);

  const { data: guideVersion } = await admin
    .from('guide_versions')
    .select('id, version, content_json')
    .eq('id', session.guide_version_id)
    .single();

  // Compute required document set and verify every required doc is present.
  const required: { doc_type: string; traveller_id: string | null }[] = [];
  for (const t of travellers ?? []) {
    required.push({ doc_type: 'passport', traveller_id: t.id });
  }
  required.push({ doc_type: 'insurance_certificate', traveller_id: null });
  if (session.has_minor) {
    for (const t of (travellers ?? []).filter((t) => t.is_minor)) {
      const sc = (scenarios ?? []).find((s) => s.traveller_id === t.id);
      const scenario = sc?.scenario ?? 'both_parents';
      for (const docType of requiredDocsForScenario(scenario)) {
        required.push({ doc_type: docType, traveller_id: t.id });
      }
    }
  }
  const uploadedKeys = new Set(
    (uploads ?? []).map((u) => `${u.doc_type}|${u.traveller_id ?? ''}`),
  );
  for (const r of required) {
    if (!uploadedKeys.has(`${r.doc_type}|${r.traveller_id ?? ''}`)) {
      throw new Error(`missing required document: ${labelForDocType(r.doc_type)}`);
    }
  }

  // Verify all 11 section acks are present and acknowledged.
  const requiredSections = (guideVersion?.content_json as any)?.sections?.map((s: any) => s.key) ?? [];
  const ackMap = new Map((acks ?? []).map((a) => [a.section_key, a.acknowledged]));
  for (const sk of requiredSections) {
    if (!ackMap.get(sk)) {
      throw new Error(`section ${sk} not acknowledged`);
    }
  }

  // Decode signature PNG and store it.
  const sigBuf = Buffer.from(parsed.signature_png_base64, 'base64');
  const sigHash = createHash('sha256').update(sigBuf).digest('hex');
  const sigPath = `signatures/${session.id}/signature.png`;
  const { error: sigUploadErr } = await admin.storage
    .from(process.env.STORAGE_BUCKET || 'sign-portal')
    .upload(sigPath, sigBuf, { contentType: 'image/png', upsert: true });
  if (sigUploadErr) throw new Error(`signature upload failed: ${sigUploadErr.message}`);

  // Strip the disclaimer text out of the stored guide JSON to keep the
  // hash small but still capture the version + section structure.
  const strippedGuide = {
    version: guideVersion?.version,
    sections: (guideVersion?.content_json as any)?.sections?.map((s: any) => ({
      key: s.key, title: s.title,
    })),
    declarations: (guideVersion?.content_json as any)?.declarations,
  };

  const finalPayload = {
    guide: strippedGuide,
    session: {
      id: session.id,
      booking_id: session.booking_id,
      reference_code: session.reference_code,
      language: session.language,
      lead_traveller_email: session.lead_traveller_email,
      lead_traveller_name: session.lead_traveller_name,
      party_size: session.party_size,
      has_minor: session.has_minor,
    },
    travellers,
    scenarios,
    uploads: (uploads ?? []).map((u) => ({
      id: u.id, doc_type: u.doc_type, traveller_id: u.traveller_id,
      original_filename: u.original_filename, sha256: u.sha256,
      byte_size: u.byte_size, uploaded_at: u.uploaded_at,
    })),
    acks,
    checklist,
    declarations_accepted: parsed.declarations,
    signature: { sha256: sigHash, byte_size: sigBuf.length },
    submitted_at: new Date().toISOString(),
  };

  const contentHash = createHash('sha256').update(canonical(finalPayload)).digest('hex');

  const ip = getClientIp(headers());
  const ua = getUserAgent(headers());

  // Insert signature_records.
  const { error: srErr } = await admin
    .from('signature_records')
    .insert({
      session_id: session.id,
      signed_name: parsed.signed_name.trim(),
      signature_image_path: sigPath,
      ip: ip ?? '0.0.0.0',
      user_agent: ua ?? '',
      declarations_json: parsed.declarations,
      content_hash: contentHash,
      guide_version_id: session.guide_version_id,
    });
  if (srErr) throw new Error(`failed to insert signature_records: ${srErr.message}`);

  // Lock the session.
  const { error: sessErr } = await admin
    .from('signature_sessions')
    .update({
      status: 'signed',
      signed_at: new Date().toISOString(),
      completed_ip: ip ?? null,
      completed_user_agent: ua ?? null,
      content_hash: contentHash,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', session.id);
  if (sessErr) throw new Error(`failed to lock session: ${sessErr.message}`);

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'sign_submit',
    event_data: { content_hash: contentHash, signature_sha256: sigHash },
    ip, user_agent: ua,
  });

  await logAudit({
    session_id: session.id,
    actor: 'system',
    event_type: 'sign_locked_after',
    event_data: { content_hash: contentHash },
    ip, user_agent: ua,
  });

  // Trigger PDF render — fire-and-forget. The user is redirected to the
  // done page immediately, which polls for pdf_path readiness.
  // We deliberately do NOT await the fetch here: Puppeteer can take 10-30s,
  // which exceeds Vercel Hobby's 10s function timeout. The done page will
  // call /api/render-pdf itself if pdf_path is still null.
  triggerPdfRender(session.id).catch((err) => {
    console.error('[submit] pdf render trigger failed', err);
  });

  revalidatePath('/sign');
  return { ok: true, content_hash: contentHash };
}

async function triggerPdfRender(sessionId: string): Promise<void> {
  // Internal call to the render route. Uses the absolute app URL.
  const url = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/render-pdf?session_id=${sessionId}`;
  try {
    await fetch(url, { method: 'POST' });
  } catch (err) {
    // Render can be retried from the admin dashboard.
    console.error('[triggerPdfRender] fetch failed', err);
  }
}
