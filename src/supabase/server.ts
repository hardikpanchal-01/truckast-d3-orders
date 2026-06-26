/**
 * Server-side Supabase client (service role — bypasses RLS).
 * Only import this from server code (server actions / route handlers).
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.warn(
    "[WARNING] SUPABASE_SERVICE_ROLE_KEY is not configured — falling back to publishable key.",
  );
}

export const supabaseServer = createClient(
  supabaseUrl,
  supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

export default supabaseServer;
