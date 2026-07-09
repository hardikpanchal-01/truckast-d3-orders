/**
 * Server-side Supabase client (service role — bypasses RLS).
 * Only import this from server code (server actions / route handlers).
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization to avoid build-time errors when env vars aren't available
let _supabaseServer: SupabaseClient | null = null;
let _supabaseAuth: SupabaseClient | null = null;

function getSupabaseServer(): SupabaseClient {
  if (!_supabaseServer) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey =
      process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
    }

    if (!supabaseServiceKey) {
      console.warn(
        "[WARNING] SUPABASE_SERVICE_ROLE_KEY is not configured — falling back to publishable key.",
      );
    }

    _supabaseServer = createClient(
      supabaseUrl,
      supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return _supabaseServer;
}

function getSupabaseAuth(): SupabaseClient {
  if (!_supabaseAuth) {
    const authSupabaseUrl = process.env.NEXT_AUTH_PUBLIC_SUPABASE_URL;
    const authSupabaseServiceKey = process.env.NEXT_AUTH_SUPABASE_SERVICE_ROLE_KEY;

    if (!authSupabaseUrl) {
      throw new Error("NEXT_AUTH_PUBLIC_SUPABASE_URL is required");
    }

    _supabaseAuth = createClient(
      authSupabaseUrl,
      authSupabaseServiceKey || process.env.NEXT_AUTH_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { autoRefreshToken: false, persistSession: false },
      },
    );
  }
  return _supabaseAuth;
}

// Export as getters that lazily initialize
export const supabaseServer = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseServer()[prop as keyof SupabaseClient];
  },
});

export const supabaseAuth = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    return getSupabaseAuth()[prop as keyof SupabaseClient];
  },
});

export default supabaseServer;
