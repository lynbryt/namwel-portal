// Browser-side Supabase client. Used ONLY for reading the auth session
// inside React components for UI affordances (e.g. "you are signed in").
// All data access happens through server actions, never via this client.
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
