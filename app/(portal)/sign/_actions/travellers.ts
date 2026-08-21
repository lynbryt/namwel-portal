'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';

const TravellerSchema = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().min(1).max(200),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  role: z.enum(['lead', 'spouse', 'child', 'companion', 'other']),
  passport_number: z.string().max(50).optional().nullable(),
  passport_expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  passport_country: z.string().max(10).optional().nullable(),
});

export type TravellerInput = z.infer<typeof TravellerSchema>;

export async function upsertTraveller(input: TravellerInput) {
  const session = await requirePortalSession();
  const parsed = TravellerSchema.parse(input);

  const dob = new Date(parsed.date_of_birth);
  const isMinor = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25) < 18;

  if (session.party_size === null) {
    throw new Error('party size not set');
  }

  const admin = getAdmin();
  let row;
  if (parsed.id) {
    const { data, error } = await admin
      .from('travellers')
      .update({
        full_name: parsed.full_name,
        date_of_birth: parsed.date_of_birth,
        is_minor: isMinor,
        role: parsed.role,
        passport_number: parsed.passport_number ?? null,
        passport_expiry: parsed.passport_expiry ?? null,
        passport_country: parsed.passport_country ?? null,
      })
      .eq('id', parsed.id)
      .eq('session_id', session.id)
      .select()
      .single();
    if (error) throw new Error('failed to update traveller');
    row = data;
  } else {
    // assign ordinal = current count + 1
    const { count } = await admin
      .from('travellers')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id);
    const ordinal = (count ?? 0) + 1;
    const { data, error } = await admin
      .from('travellers')
      .insert({
        session_id: session.id,
        full_name: parsed.full_name,
        date_of_birth: parsed.date_of_birth,
        is_minor: isMinor,
        role: parsed.role,
        passport_number: parsed.passport_number ?? null,
        passport_expiry: parsed.passport_expiry ?? null,
        passport_country: parsed.passport_country ?? null,
        ordinal,
      })
      .select()
      .single();
    if (error) throw new Error('failed to insert traveller');
    row = data;
  }

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: parsed.id ? 'traveller_updated' : 'traveller_added',
    event_data: { traveller_id: row.id, is_minor: isMinor },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/sign');
  return { ok: true, id: row.id, is_minor: isMinor };
}

export async function listTravellers() {
  const session = await requirePortalSession();
  const { data, error } = await getAdmin()
    .from('travellers')
    .select('*')
    .eq('session_id', session.id)
    .order('ordinal', { ascending: true });
  if (error) throw new Error('failed to list travellers');
  return data ?? [];
}
