// Download endpoint. Returns a 1h signed URL to the signed PDF for
// the authenticated session. Audit-logs each download.

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { requirePortalSession } from '@/lib/auth/session';
import { getAdmin } from '@/lib/supabase/admin';
import { logAudit, getClientIp, getUserAgent } from '@/lib/audit/log';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await requirePortalSession();
    if (session.status !== 'signed') {
      return NextResponse.json({ error: 'not signed' }, { status: 403 });
    }

    const admin = getAdmin();
    const { data: row } = await admin
      .from('signature_sessions')
      .select('pdf_path')
      .eq('id', session.id)
      .single();
    if (!row?.pdf_path) {
      return NextResponse.json({ error: 'pdf not yet rendered' }, { status: 404 });
    }

    const { data: signed, error } = await admin.storage
      .from(process.env.STORAGE_BUCKET || 'sign-portal')
      .createSignedUrl(row.pdf_path, Number(process.env.SIGNED_URL_TTL_SECONDS || 3600));
    if (error || !signed) {
      return NextResponse.json({ error: 'failed to mint url' }, { status: 500 });
    }

    await logAudit({
      session_id: session.id,
      actor: `client:${session.reference_code}`,
      event_type: 'admin_download', // closest event for now; can be split later
      event_data: { kind: 'pdf' },
      ip: getClientIp(headers()),
      user_agent: getUserAgent(headers()),
    });

    return NextResponse.redirect(signed.signedUrl);
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}
