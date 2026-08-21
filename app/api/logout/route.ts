// Logout — clears the portal session cookie and redirects to /login.

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  clearSessionCookie();
  return NextResponse.redirect(new URL('/login', req.url));
}
