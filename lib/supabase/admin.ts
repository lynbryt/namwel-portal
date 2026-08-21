// Service-role Supabase client. Bypasses RLS. SERVER-ONLY.
// Never import this from a client component or any code that ends up in
// a client bundle.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Use a loose typed client (any) and apply runtime types where needed.
// The Database type lives in `./database.ts` for reference and IDE help.
let cached: SupabaseClient | null = null;

export function getAdmin(): SupabaseClient {
  if (cached) return cached;
  console.log('[admin] creating service-role client. URL=', (process.env.NEXT_PUBLIC_SUPABASE_URL || 'MISSING').slice(0, 40), '... key_len=', (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length);
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  return cached;
}
