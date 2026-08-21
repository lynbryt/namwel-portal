// Portal session helpers.
// We mint a small JWT containing {session_id, ref} and store it in an
// HTTP-only, SameSite=Lax cookie. The cookie is the only thing that
// authorises the client; the JWT is verified on every server action.

import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAdmin } from '@/lib/supabase/admin';

const COOKIE_NAME = 'portal_session';
const ALG = 'HS256';

function secret(): Uint8Array {
  const s = process.env.PORTAL_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('PORTAL_JWT_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(s);
}

export type PortalClaims = {
  session_id: string;
  ref: string;
  exp: number;
};

export async function mintSessionToken(sessionId: string, ref: string): Promise<string> {
  const ttl = Number(process.env.PORTAL_SESSION_TTL_HOURS ?? 24) * 3600;
  return new SignJWT({ session_id: sessionId, ref })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<PortalClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return payload as unknown as PortalClaims;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const ttl = Number(process.env.PORTAL_SESSION_TTL_HOURS ?? 24) * 3600;
  // Cookie domain rules:
  //  - For a single-host deployment, the browser scopes the cookie to the
  //    current host automatically, which is what we want.
  //  - We only set an explicit domain if the env var is set AND the current
  //    request is on a host that matches it. This keeps the cookie working
  //    on `*.vercel.app` previews AND on the eventual custom domain, without
  //    having to flip env vars by hand.
  //  - If PORTAL_COOKIE_DOMAIN looks like a URL (`https://...`) or has a
  //    path or port, ignore it.
  const raw = (process.env.PORTAL_COOKIE_DOMAIN || '').trim();
  const isValidDomain = /^\.?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(raw);
  const currentHost = (await import('next/headers')).headers().get('host') || '';
  // Only use the env var if the current host actually matches it
  // (e.g. PORTAL_COOKIE_DOMAIN=".namwel.com.na" + host="info.namwel.com.na").
  // Otherwise leave undefined → browser scopes to current host (vercel.app etc.).
  let cookieDomain: string | undefined = undefined;
  if (isValidDomain && currentHost) {
    const stripped = raw.startsWith('.') ? raw.slice(1) : raw;
    if (currentHost === stripped || currentHost.endsWith('.' + stripped)) {
      cookieDomain = raw;
    }
  }
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ttl,
    domain: cookieDomain,
  });
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME);
}

export async function getSessionFromCookie(): Promise<PortalClaims | null> {
  const c = cookies().get(COOKIE_NAME);
  if (!c?.value) return null;
  return verifySessionToken(c.value);
}

export type PortalSession = {
  id: string;
  booking_id: string;
  reference_code: string;
  status: string;
  language: 'en' | 'fr';
  lead_traveller_email: string;
  lead_traveller_name: string;
  party_size: number | null;
  has_minor: boolean | null;
  guide_version_id: string;
  expires_at: string;
  created_at: string;
  signed_at: string | null;
  previous_session_id: string | null;
};

/**
 * Hard session guard. Use at the top of every portal server action and
 * every /portal/* page. Returns the live session row or redirects to login.
 */
export async function requirePortalSession(): Promise<PortalSession> {
  const claims = await getSessionFromCookie();
  if (!claims) redirect('/login');

  const { data, error } = await getAdmin()
    .from('signature_sessions')
    .select('id, booking_id, reference_code, status, language, lead_traveller_email, lead_traveller_name, party_size, has_minor, guide_version_id, expires_at, created_at, signed_at, previous_session_id')
    .eq('id', claims.session_id)
    .single();

  if (error || !data) {
    clearSessionCookie();
    redirect('/login');
  }

  const session = data as PortalSession;

  if (session.status === 'expired' || session.status === 'revoked' || session.status === 'archived') {
    clearSessionCookie();
    redirect('/login?reason=inactive');
  }

  if (new Date(session.expires_at) < new Date()) {
    await getAdmin()
      .from('signature_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id);
    clearSessionCookie();
    redirect('/login?reason=expired');
  }

  return session;
}
