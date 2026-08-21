// scripts/create-test-session.js
//
// Creates a test signing session so you can log in to the portal locally.
// Usage:
//   node scripts/create-test-session.js
//   node scripts/create-test-session.js --ref NMT-TEST1 --email [email protected] --name "Demo Lead" --password testpass123
//
// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from .env.local (Next.js
// will load them automatically when you `npm run dev`, but for this script
// we read the file directly).

const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(p)) {
    throw new Error('.env.local not found in ' + process.cwd());
  }
  const out = {};
  for (const line of fs.readFileSync(p, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (m[2].startsWith('"') && m[2].endsWith('"')) out[m[1]] = m[2].slice(1, -1);
    else out[m[1]] = m[2];
  }
  return out;
}

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 ? process.argv[i + 1] : def;
}

function assertValidRef(ref) {
  // Reference alphabet: A-Z (no I, O) + 2-9 (no 0, 1)
  if (!/^NMT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/.test(ref)) {
    console.error(`\n  ERROR: "${ref}" is not a valid reference code.`);
    console.error('  Format:  NMT-XXXXXX  (6 chars after the dash)');
    console.error('  Allowed: A-Z (except I, O) and digits 2-9.\n');
    process.exit(1);
  }
}

(async () => {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be in .env.local');
  }

  const referenceCode = (arg('ref', 'NMT-TESTX2')).toUpperCase();
  assertValidRef(referenceCode);
  const leadEmail    = arg('email', '[email protected]');
  const leadName     = arg('name',  'Demo Lead');
  const password     = arg('password', 'testpass123');
  const bookingId    = arg('booking', 'BOOKING-DEMO');

  // Hash the password with argon2id (same params as lib/auth/password.ts).
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 1. Confirm a deposit (so the gate is open).
  // The deposits table has a PARTIAL unique index (only when confirmed_at
  // is not null), which Postgres does NOT accept as an ON CONFLICT target.
  // So we delete-then-insert instead.
  await supabase.from('deposits').delete().eq('booking_id', bookingId);
  const { error: depErr } = await supabase
    .from('deposits')
    .insert({
      booking_id: bookingId,
      amount: 5000,
      confirmed_at: new Date().toISOString(),
      reference: 'TRX-DEMO',
    });
  if (depErr) throw new Error('deposit insert failed: ' + depErr.message);

  // 2. Look up the active guide version.
  const { data: gv, error: gvErr } = await supabase
    .from('guide_versions')
    .select('id, version')
    .is('retired_at', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .single();
  if (gvErr || !gv) throw new Error('no active guide version: ' + (gvErr?.message || ''));

  // 3. Upsert the session.
  const { data, error } = await supabase
    .from('signature_sessions')
    .upsert(
      {
        booking_id: bookingId,
        reference_code: referenceCode,
        password_hash: passwordHash,
        guide_version_id: gv.id,
        lead_traveller_email: leadEmail,
        lead_traveller_name: leadName,
        status: 'pending',
        expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
        party_size: 2,
        has_minor: false,
      },
      { onConflict: 'reference_code' }
    )
    .select()
    .single();
  if (error) throw new Error('session upsert failed: ' + error.message);

  console.log('\n========================================');
  console.log('  Test session created');
  console.log('========================================');
  console.log('  Reference  :', referenceCode);
  console.log('  Password   :', password);
  console.log('  Email      :', leadEmail);
  console.log('  Name       :', leadName);
  console.log('  Booking    :', bookingId);
  console.log('  Guide ver  :', gv.version);
  console.log('  Status     :', data.status);
  console.log('  Expires    :', data.expires_at);
  console.log('========================================');
  console.log('  Log in at  : http://localhost:3000/login');
  console.log('========================================\n');
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
