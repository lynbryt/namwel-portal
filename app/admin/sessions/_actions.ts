'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { hash } from '@node-rs/argon2';
import { getAdmin } from '@/lib/supabase/admin';

// `Algorithm` is a const enum in @node-rs/argon2 — use numeric value directly.
//   Argon2d = 0, Argon2i = 1, Argon2id = 2
const ARGON2ID = 2 as const;
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';
import { generateUniqueReference, generatePassword } from '@/lib/admin/generate';
import { createClient as createServerSupabase } from '@/lib/supabase/server';

const InputSchema = z.object({
  booking_id: z.string().min(1).max(80).trim(),
  lead_traveller_name: z.string().min(1).max(200).trim(),
  lead_traveller_email: z.string().email().max(200).trim().toLowerCase(),
  party_size: z.number().int().min(1).max(20),
  has_minor: z.boolean(),
  confirm_deposit: z.boolean(),
  deposit_amount: z.number().min(0).max(99_999_999).optional().nullable(),
  deposit_reference: z.string().max(120).optional().nullable(),
  deposit_currency: z.string().length(3).default('NAD'),
  window_days: z.number().int().min(1).max(365).default(30),
});

export type CreateSessionInput = z.infer<typeof InputSchema>;

// Admin guard: must be signed in via Supabase auth AND have a user_role row.
async function requireAdmin() {
  const supabase = createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('not signed in');

  const { data: role } = await getAdmin()
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .maybeSingle();

  if (!role) throw new Error('no admin role');
  return { user, role: role.role };
}

export type CreateSessionResult =
  | { ok: true; id: string; reference_code: string; password: string; lead_traveller_email: string }
  | { ok: false; error: string };

export async function createSigningSession(rawInput: unknown): Promise<CreateSessionResult> {
  let adminUser;
  try {
    adminUser = await requireAdmin();
  } catch (e: any) {
    return { ok: false, error: e.message };
  }

  const parsed = InputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues.map((i) => i.message).join('; ') };
  }
  const input = parsed.data;

  const supabase = getAdmin();

  // 1. Confirm deposit (or require it pre-exists).
  if (input.confirm_deposit) {
    if (input.deposit_amount == null) {
      return { ok: false, error: 'deposit amount required when confirming a deposit' };
    }
    // delete-then-insert (partial unique index, no ON CONFLICT)
    await supabase.from('deposits').delete().eq('booking_id', input.booking_id);
    const { error: depErr } = await supabase
      .from('deposits')
      .insert({
        booking_id: input.booking_id,
        amount: input.deposit_amount,
        currency: input.deposit_currency,
        confirmed_at: new Date().toISOString(),
        confirmed_by: adminUser.user.id,
        reference: input.deposit_reference ?? null,
        notes: 'Created via admin form',
      });
    if (depErr) return { ok: false, error: `deposit insert failed: ${depErr.message}` };
  } else {
    const { data: dep, error: depQErr } = await supabase
      .from('deposits')
      .select('id, confirmed_at')
      .eq('booking_id', input.booking_id)
      .maybeSingle();
    if (depQErr) return { ok: false, error: `deposit lookup failed: ${depQErr.message}` };
    if (!dep || !dep.confirmed_at) {
      return { ok: false, error: 'no confirmed deposit for this booking — tick "Confirm deposit" to create one' };
    }
  }

  // 2. Find the active guide version.
  const { data: gv, error: gvErr } = await supabase
    .from('guide_versions')
    .select('id, version')
    .is('retired_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();
  if (gvErr || !gv) {
    return { ok: false, error: 'no active guide version — run migration 0004' };
  }

  // 3. Generate a unique reference code.
  const referenceCode = await generateUniqueReference(async (ref) => {
    const { data } = await supabase
      .from('signature_sessions')
      .select('id')
      .eq('reference_code', ref)
      .maybeSingle();
    return !!data;
  });

  // 4. Generate a password and hash it.
  const password = generatePassword();
  const passwordHash = await hash(password, {
    algorithm: ARGON2ID,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  // 5. Insert the session.
  const expiresAt = new Date(Date.now() + input.window_days * 24 * 3600 * 1000).toISOString();
  const { data: session, error: insErr } = await supabase
    .from('signature_sessions')
    .insert({
      booking_id: input.booking_id,
      reference_code: referenceCode,
      password_hash: passwordHash,
      guide_version_id: gv.id,
      status: 'pending',
      language: 'en',
      lead_traveller_email: input.lead_traveller_email,
      lead_traveller_name: input.lead_traveller_name,
      party_size: input.party_size,
      has_minor: input.has_minor,
      expires_at: expiresAt,
    })
    .select()
    .single();
  if (insErr || !session) {
    return { ok: false, error: `session insert failed: ${insErr?.message}` };
  }

  // 6. Audit log.
  await logAudit({
    session_id: session.id,
    actor: `admin:${adminUser.user.email ?? adminUser.user.id}`,
    event_type: 'admin_session_created',
    event_data: {
      reference_code: referenceCode,
      booking_id: input.booking_id,
      party_size: input.party_size,
      has_minor: input.has_minor,
      expires_at: expiresAt,
    },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/admin');
  revalidatePath('/admin/sessions');

  return {
    ok: true,
    id: session.id,
    reference_code: referenceCode,
    password,
    lead_traveller_email: input.lead_traveller_email,
  };
}
