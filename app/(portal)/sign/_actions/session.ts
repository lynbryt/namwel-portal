'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';

const PartySchema = z.object({
  party_size: z.number().int().min(1).max(20),
  has_minor: z.boolean(),
});

export type PartyInput = z.infer<typeof PartySchema>;

export async function setParty(input: PartyInput) {
  const session = await requirePortalSession();
  const parsed = PartySchema.parse(input);

  const admin = getAdmin();
  const { error } = await admin
    .from('signature_sessions')
    .update({
      party_size: parsed.party_size,
      has_minor: parsed.has_minor,
      status: session.status === 'pending' ? 'in_progress' : session.status,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (error) throw new Error('failed to set party size');

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'party_size_set',
    event_data: parsed,
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/sign');
  return { ok: true };
}

const HeartbeatSchema = z.object({});

export async function heartbeat() {
  const session = await requirePortalSession();
  HeartbeatSchema.parse({});
  await getAdmin()
    .from('signature_sessions')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', session.id);
  return { ok: true };
}
