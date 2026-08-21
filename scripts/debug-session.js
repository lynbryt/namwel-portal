// scripts/debug-session.js
// Diagnose why a test session login might be failing.
// Prints the session row + deposit row + hash prefix for the reference code.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) throw new Error('.env.local not found');
  const out = {};
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim().replace(/^"|"$/g, '');
    out[k] = v;
  }
  return out;
}

(async () => {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local');

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const ref = 'NMT-TEST1';
  const booking = 'BOOKING-DEMO';

  console.log('Connecting to:', url);
  console.log('');
  console.log('--- SESSION LOOKUP ---');
  const { data: sessions, error: sErr } = await supabase
    .from('signature_sessions')
    .select('reference_code, status, lead_traveller_email, lead_traveller_name, party_size, has_minor, expires_at, password_hash, created_at, last_activity_at')
    .eq('reference_code', ref);
  console.log('error:', sErr);
  console.log('count:', sessions?.length ?? 0);
  if (sessions && sessions[0]) {
    const s = sessions[0];
    console.log('ref:           ', s.reference_code);
    console.log('status:        ', s.status);
    console.log('email:         ', s.lead_traveller_email);
    console.log('name:          ', s.lead_traveller_name);
    console.log('party_size:    ', s.party_size);
    console.log('has_minor:     ', s.has_minor);
    console.log('expires_at:    ', s.expires_at, '(', new Date(s.expires_at) < new Date() ? 'EXPIRED' : 'valid', ')');
    console.log('created_at:    ', s.created_at);
    console.log('hash prefix:   ', (s.password_hash || '').slice(0, 30));
    console.log('hash length:   ', (s.password_hash || '').length);
  }

  console.log('');
  console.log('--- DEPOSIT LOOKUP ---');
  const { data: deposits, error: dErr } = await supabase
    .from('deposits')
    .select('booking_id, amount, confirmed_at, reference, created_at')
    .eq('booking_id', booking);
  console.log('error:', dErr);
  console.log('count:', deposits?.length ?? 0);
  if (deposits && deposits[0]) {
    const d = deposits[0];
    console.log('booking_id:    ', d.booking_id);
    console.log('amount:        ', d.amount, d.currency || '');
    console.log('confirmed_at:  ', d.confirmed_at, '(', d.confirmed_at ? 'CONFIRMED' : 'NOT CONFIRMED', ')');
    console.log('reference:     ', d.reference);
  }

  console.log('');
  console.log('--- ALL SESSIONS (just so you can see what is in the DB) ---');
  const { data: all } = await supabase
    .from('signature_sessions')
    .select('reference_code, status, lead_traveller_email, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  console.log(all);
})().catch((e) => {
  console.error('SCRIPT FAILED:', e.message);
  process.exit(1);
});
