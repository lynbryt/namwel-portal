'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getAdmin } from '@/lib/supabase/admin';
import { requirePortalSession } from '@/lib/auth/session';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';

const AckSchema = z.object({
  section_key: z.string().min(1).max(64),
  acknowledged: z.boolean(),
});

export async function acknowledgeSection(input: z.infer<typeof AckSchema>) {
  const session = await requirePortalSession();
  const parsed = AckSchema.parse(input);

  const admin = getAdmin();
  const { data: existing } = await admin
    .from('section_acknowledgments')
    .select('id')
    .eq('session_id', session.id)
    .eq('section_key', parsed.section_key)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('section_acknowledgments')
      .update({
        acknowledged: parsed.acknowledged,
        acknowledged_at: parsed.acknowledged ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);
    if (error) throw new Error('failed to update acknowledgment');
  } else {
    const { error } = await admin
      .from('section_acknowledgments')
      .insert({
        session_id: session.id,
        section_key: parsed.section_key,
        acknowledged: parsed.acknowledged,
        acknowledged_at: parsed.acknowledged ? new Date().toISOString() : null,
      });
    if (error) throw new Error('failed to insert acknowledgment');
  }

  if (parsed.acknowledged) {
    await logAudit({
      session_id: session.id,
      actor: `client:${session.reference_code}`,
      event_type: 'section_acknowledged',
      event_data: { section_key: parsed.section_key },
      ip: getClientIp(headers()),
      user_agent: getUserAgent(headers()),
    });
  }

  revalidatePath('/sign/reading');
  return { ok: true };
}

const ChecklistSchema = z.object({
  item_key: z.string().min(1).max(64),
  checked: z.boolean(),
});

export async function toggleChecklistItem(input: z.infer<typeof ChecklistSchema>) {
  const session = await requirePortalSession();
  const parsed = ChecklistSchema.parse(input);

  const admin = getAdmin();
  const { data: existing } = await admin
    .from('checklist_state')
    .select('id')
    .eq('session_id', session.id)
    .eq('item_key', parsed.item_key)
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from('checklist_state')
      .update({
        checked: parsed.checked,
        checked_at: parsed.checked ? new Date().toISOString() : null,
      })
      .eq('id', existing.id);
    if (error) throw new Error('failed to update checklist item');
  } else {
    const { error } = await admin
      .from('checklist_state')
      .insert({
        session_id: session.id,
        item_key: parsed.item_key,
        checked: parsed.checked,
        checked_at: parsed.checked ? new Date().toISOString() : null,
      });
    if (error) throw new Error('failed to insert checklist item');
  }

  await logAudit({
    session_id: session.id,
    actor: `client:${session.reference_code}`,
    event_type: 'checklist_toggled',
    event_data: { item_key: parsed.item_key, checked: parsed.checked },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/sign/checklist');
  return { ok: true };
}
