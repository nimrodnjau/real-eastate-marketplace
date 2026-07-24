import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Check .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// All marketplace tables (profiles, listings, etc.) live in the "marketplace"
// schema, not "public" — this keeps them fully separate from the Finance ERP
// tables in the same Supabase project. Use `db` for any marketplace table
// query; use `supabase.auth` as normal for authentication (auth.users is a
// project-wide schema shared with the ERP logins).
export const db = supabase.schema('marketplace');