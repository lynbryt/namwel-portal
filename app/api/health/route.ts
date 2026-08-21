// GET /api/health
// Diagnostic endpoint. Reports:
//   - which env vars are present (and length — to catch empty strings)
//   - whether the Supabase admin client can connect
//
// Safe to expose publicly. Returns no secrets.

import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const REQUIRED = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'PORTAL_JWT_SECRET',
  'PORTAL_COOKIE_DOMAIN',
  'NEXT_PUBLIC_APP_URL',
  'STORAGE_BUCKET',
  'SIGNED_URL_TTL_SECONDS',
  'SIGNING_WINDOW_DAYS',
  'RETENTION_YEARS',
];

export async function GET() {
  const envReport: Record<string, { present: boolean; length: number; prefix: string }> = {};
  for (const k of REQUIRED) {
    const v = process.env[k] ?? '';
    envReport[k] = {
      present: v.length > 0,
      length: v.length,
      prefix: v.length > 0 ? v.slice(0, 4) : '',
    };
  }

  // Try the Supabase connection
  let dbOk = false;
  let dbError: string | null = null;
  let sessionCount: number | null = null;
  try {
    const admin = getAdmin();
    const { count, error } = await admin
      .from('signature_sessions')
      .select('*', { count: 'exact', head: true });
    if (error) {
      dbError = error.message;
    } else {
      dbOk = true;
      sessionCount = count ?? 0;
    }
  } catch (e: any) {
    dbError = e?.message ?? 'unknown';
  }

  const allPresent = Object.values(envReport).every((v) => v.present);
  const status = allPresent && dbOk ? 'ok' : 'degraded';

  return NextResponse.json({
    status,
    timestamp: new Date().toISOString(),
    env: envReport,
    database: {
      reachable: dbOk,
      sessionCount,
      error: dbError,
    },
    node: process.version,
    vercel: process.env.VERCEL ? 'vercel' : 'local',
  }, { status: allPresent && dbOk ? 200 : 503 });
}
