'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getAdmin } from '@/lib/supabase/admin';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';

const DepositSchema = z.object({
  booking_id: z.string().min(1).max(64).trim(),
  amount: z.coerce.number().positive().max(10_000_000),
  currency: z.string().min(1).max(10).default('NAD'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(500).optional(),
});

export type CreateDepositInput = z.infer<typeof DepositSchema>;

export async function createConfirmedDeposit(input: CreateDepositInput) {
  const parsed = DepositSchema.parse(input);
  const admin = getAdmin();

  // Replace any existing rows for this booking.
  await admin.from('deposits').delete().eq('booking_id', parsed.booking_id);

  const { data, error } = await admin
    .from('deposits')
    .insert({
      booking_id: parsed.booking_id,
      amount: parsed.amount,
      currency: parsed.currency,
      confirmed_at: new Date().toISOString(),
      reference: parsed.reference ?? null,
      notes: parsed.notes ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`deposit insert failed: ${error.message}`);

  await logAudit({
    actor: 'admin',
    event_type: 'admin_deposit_confirmed',
    event_data: { booking_id: parsed.booking_id, amount: parsed.amount, currency: parsed.currency, reference: parsed.reference },
    ip: getClientIp(headers()),
    user_agent: getUserAgent(headers()),
  });

  revalidatePath('/admin/deposits');
  return { ok: true, id: data.id };
}

export async function revokeDeposit(bookingId: string) {
  const admin = getAdmin();
  await admin.from('deposits').delete().eq('booking_id', bookingId);
  revalidatePath('/admin/deposits');
  return { ok: true };
}
