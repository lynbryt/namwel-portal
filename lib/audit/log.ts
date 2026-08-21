// Append-only audit log writer.
// The audit_log table has no UPDATE policy and only the service_role can
// insert. This helper is the only place in the app that writes to it.

import { getAdmin } from '@/lib/supabase/admin';

export type AuditEvent =
  | 'login_attempt'
  | 'login_ok'
  | 'login_fail'
  | 'login_locked'
  | 'session_refresh'
  | 'session_expired'
  | 'party_size_set'
  | 'traveller_added'
  | 'traveller_updated'
  | 'section_acknowledged'
  | 'checklist_toggled'
  | 'child_scenario_saved'
  | 'document_uploaded'
  | 'document_verified'
  | 'document_rejected'
  | 'sign_attempt'
  | 'sign_submit'
  | 'sign_locked_after'
  | 'pdf_rendered'
  | 'pdf_emailed'
  | 'admin_view'
  | 'admin_download'
  | 'admin_reissue'
  | 'admin_deposit_confirmed'
  | 'admin_session_created'
  | 'admin_role_granted'
  | 'admin_role_revoked'
  | 'email_resent'
  | 'rate_limited';

export type AuditPayload = {
  session_id?: string | null;
  actor: string;
  event_type: AuditEvent;
  event_data?: Record<string, unknown> | null;
  ip?: string | null;
  user_agent?: string | null;
};

export async function logAudit(p: AuditPayload): Promise<void> {
  try {
    await getAdmin().from('audit_log').insert({
      session_id: p.session_id ?? null,
      actor: p.actor,
      event_type: p.event_type,
      event_data: p.event_data ?? null,
      ip: p.ip ?? null,
      user_agent: p.user_agent ?? null,
      occurred_at: new Date().toISOString(),
    });
  } catch (err) {
    // We never want audit-write failure to block the user. Log to stderr
    // and continue. Operators should monitor audit_log row count.
    console.error('[audit] failed to write event', p.event_type, err);
  }
}

export function getClientIp(headers: Headers): string | null {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return headers.get('x-real-ip') || null;
}

export function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent');
}
