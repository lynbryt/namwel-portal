// POST /api/login
// Receives { reference, password } as JSON.
// Verifies against the signature_sessions table.
// On success: sets the portal_session cookie, returns 200.
// On failure: returns 401 with an error code.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/supabase/admin';
import { verifyPassword } from '@/lib/auth/password';
import { normaliseReference, isValidReference } from '@/lib/auth/reference';
import { mintSessionToken, setSessionCookie } from '@/lib/auth/session';
import { checkRateLimit, recordFail, recordSuccess } from '@/lib/auth/rate-limit';
import { logAudit } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  reference: z.string().min(1).max(64),
  password: z.string().min(1).max(200),
});

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    null;
  const ua = req.headers.get('user-agent');

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 });
  }

  const ref = normaliseReference(parsed.data.reference);
  const limitKey = `${ip ?? 'unknown'}|${ref}`;

  console.log('[api/login] attempt ref=', ref, 'pwd_len=', parsed.data.password.length, 'ip=', ip);

  // Rate limit
  const limit = checkRateLimit(limitKey);
  if (limit.locked) {
    await logAudit({
      actor: `client:${ref}`,
      event_type: 'login_locked',
      event_data: { reason: 'rate_limit', reset_in: limit.resetIn },
      ip, user_agent: ua,
    });
    return NextResponse.json(
      { ok: false, error: 'locked', minutes: Math.ceil(limit.resetIn / 60000) },
      { status: 429 },
    );
  }

  if (!isValidReference(ref)) {
    recordFail(limitKey);
    console.log('[api/login] invalid format ref=', ref);
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 });
  }

  const admin = getAdmin();
  const { data: session, error: dbErr } = await admin
    .from('signature_sessions')
    .select('id, reference_code, status, password_hash, expires_at, lead_traveller_name')
    .eq('reference_code', ref)
    .maybeSingle();

  if (dbErr || !session) {
    recordFail(limitKey);
    console.log('[api/login] session not found, ref=', ref, 'dbErr=', dbErr?.message);
    await logAudit({
      actor: `client:${ref}`,
      event_type: 'login_fail',
      event_data: { reason: 'not_found' },
      ip, user_agent: ua,
    });
    return NextResponse.json({
      ok: false,
      error: 'invalid',
      debug: { ref, dbErr: dbErr?.message ?? null, hasSession: !!session },
    }, { status: 401 });
  }

  console.log('[api/login] session found, status=', session.status, 'hash_prefix=', session.password_hash?.slice(0, 30));

  if (session.status !== 'pending' && session.status !== 'in_progress') {
    return NextResponse.json({ ok: false, error: 'inactive' }, { status: 403 });
  }

  if (new Date(session.expires_at) < new Date()) {
    await admin.from('signature_sessions').update({ status: 'expired' }).eq('id', session.id);
    return NextResponse.json({ ok: false, error: 'expired' }, { status: 403 });
  }

  const ok = await verifyPassword(session.password_hash, parsed.data.password);
  console.log('[api/login] verify result=', ok);
  if (!ok) {
    const after = recordFail(limitKey);
    await logAudit({
      session_id: session.id,
      actor: `client:${ref}`,
      event_type: 'login_fail',
      event_data: { reason: 'bad_password', locked_now: after.locked },
      ip, user_agent: ua,
    });
    if (after.locked) {
      return NextResponse.json(
        { ok: false, error: 'locked', minutes: Math.ceil(after.resetIn / 60000) },
        { status: 429 },
      );
    }
    return NextResponse.json({
      ok: false,
      error: 'invalid',
      debug: {
        ref,
        status: session.status,
        hashPrefix: session.password_hash?.slice(0, 30),
        passwordLen: parsed.data.password.length,
        verifyResult: ok,
      },
    }, { status: 401 });
  }

  recordSuccess(limitKey);
  const token = await mintSessionToken(session.id, session.reference_code);
  await setSessionCookie(token);

  await logAudit({
    session_id: session.id,
    actor: `client:${ref}`,
    event_type: 'login_ok',
    ip, user_agent: ua,
  });

  return NextResponse.json({ ok: true, redirect: '/sign' });
}
