/**
 * Auth Server Supabase Client
 *
 * This client connects to the central Auth database for tenant management.
 * Uses SERVICE ROLE KEY which bypasses RLS policies.
 *
 * IMPORTANT: Only use this for server-side operations (API routes, server actions).
 * NEVER expose this to client-side code!
 */

import { createClient } from "@supabase/supabase-js";

const authSupabaseUrl = process.env.NEXT_AUTH_PUBLIC_SUPABASE_URL;
const authSupabaseServiceKey = process.env.NEXT_AUTH_SUPABASE_SERVICE_ROLE_KEY;

// Validate environment variables
if (!authSupabaseUrl) {
  console.error(
    "[AUTH SUPABASE] NEXT_AUTH_PUBLIC_SUPABASE_URL is not configured!"
  );
}

if (!authSupabaseServiceKey) {
  console.error(
    "[AUTH SUPABASE] NEXT_AUTH_SUPABASE_SERVICE_ROLE_KEY is not configured!"
  );
}

// Create server-side client for Auth database
let supabaseAuthServer;

if (authSupabaseUrl && authSupabaseServiceKey) {
  supabaseAuthServer = createClient(authSupabaseUrl, authSupabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: "auth_tenant",
    },
  });
} else {
  // Create a dummy client that will throw errors when used
  // This prevents the app from crashing during build
  supabaseAuthServer = createClient(
    "https://placeholder.supabase.co",
    "placeholder-key",
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: "auth_tenant",
      },
    }
  );
}

export { supabaseAuthServer };
export default supabaseAuthServer;
