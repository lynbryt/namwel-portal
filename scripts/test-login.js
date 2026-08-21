// scripts/test-login.js
// Tries the obvious passwords against the stored hash and prints which one
// (if any) verifies. Run from your project root:
//   node scripts/test-login.js

const fs = require('fs');
const path = require('path');
const argon2 = require('argon2');
const { createClient } = require('@supabase/supabase-js');

function loadEnvLocal() {
  const p = path.join(process.cwd(), '.env.local');
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
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const ref = process.argv[2] || 'NMT-TESTX2';
  const { data: sessions, error } = await supabase
    .from('signature_sessions')
    .select('password_hash')
    .eq('reference_code', ref)
    .single();

  if (error || !sessions) {
    console.log('No session found for', ref);
    process.exit(1);
  }

  const hash = sessions.password_hash;
  console.log('Hash prefix:', hash.slice(0, 40), '...');
  console.log('');

  const candidates = [
    'testpass123',
    'Testpass123',
    'TESTPASS123',
    'testpass',
    'password',
    'Password1',
    'demo123',
    'namwel123',
  ];

  console.log('Testing candidate passwords:');
  for (const p of candidates) {
    try {
      const ok = await argon2.verify(hash, p);
      console.log(`  ${ok ? '✓ MATCH' : '✗ no   '}  "${p}"`);
      if (ok) {
        console.log('');
        console.log('========================================');
        console.log('  Use this password to log in:');
        console.log('  Reference:', ref);
        console.log('  Password: ', p);
        console.log('========================================');
      }
    } catch (e) {
      console.log(`  ✗ error  "${p}":`, e.message);
    }
  }
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
