'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';
import { requiredDocsForScenario } from '@/lib/uploads/doc-types';

const ChildScenarioSchema = z.object({
  traveller_id: z.string().uuid(),
  scenario: z.enum(['both_parents', 'one_parent', 'grandparent_guardian', 'unaccompanied']),
  non_travelling_parent_name: z.string().max(200).optional().nullable(),
  non_travelling_parent_id_last4: z.string().max(10).optional().nullable(),
  receiving_person_name: z.string().max(200).optional().nullable(),
  receiving_person_address: z.string().max(500).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ChildScenarioInput = z.infer<typeof ChildScenarioSchema>;

export async function saveChildScenario(input: ChildScenarioInput) {
  const session = await requirePortalSession();
  const parsed = ChildScenarioSchema.parse(input);

  // Verify the traveller belongs to this session and is a minor.
  const admin = getAdmin();
  const { data: t, error: terr } = await admin
    .from('travellers')
    .select('id, is_minor, session_id')
    .eq('id', parsed.traveller_id)
    .single();
  if (terr || !t || t.session_id !== session.id || !t.is_minor) {
    throw new Error('traveller not found or not a minor');
  }

  // Upsert by traveller_id.
  const { data: existing } = await admin
    .from('child_scenarios')
    .select('id')
    .eq('traveller_id', parsed.traveller_id)
    .maybeSingle();

  let row;
  if (existing) {
    const { data, error } = await admin
      .from('child_scenarios')
      .update({
        scenario: parsed.scenario,
        non_travelling_parent_name: parsed.non_travelling_parent_name ?? null,
        non_travelling_parent_id_last4: parsed.non_travelling_parent_id_last4 ?? null,
        receiving_person_name: parsed.receiving_person_name ?? null,
        receiving_person_address: parsed.receiving_person_address ?? null,
        notes: parsed.notes ?? null,
      })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new Error('failed to update child scenario');
    row = data;
  } else {
    const { data, error } = await admin
      .from('child_scenarios')
      .insert({
        traveller_id: parsed.traveller_id,
        scenario: parsed.scenario,
        non_travelling_parent_name: parsed.non_travelling_parent_name ?? null,
        non_travelling_parent_id_last4: parsed.non_travelling_parent_id_last4 ?? null,
        receiving_person_name: parsed.receiving_person_name ?? null,
        receiving_person_address: parsed.receiving_person_address ?? null,
        notes: parsed.notes ?? null,
      })
      .select()
      .single();
    if (error) throw new Error('failed to insert child scenario');
    row = data;
  }

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'child_scenario_saved',
    event_data: { traveller_id: parsed.traveller_id, scenario: parsed.scenario },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/sign/children');
  return { ok: true, id: row.id };
}
