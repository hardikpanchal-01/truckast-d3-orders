"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { supabaseAuth } from "@/supabase/server";
import { getPgAdapterClient } from "@/supabase/pg-adapter";
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

// Get encryption key from environment variable (same as auth-truckast-ai)
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_SECRET_KEY;

  if (!key) {
    throw new Error("ENCRYPTION_SECRET_KEY environment variable is not set");
  }

  // If key is less than 32 bytes, pad it; if more, hash it to get exactly 32 bytes
  if (key.length < 32) {
    return Buffer.from(key.padEnd(32, "0"));
  } else if (key.length > 32) {
    return crypto.createHash("sha256").update(key).digest();
  }

  return Buffer.from(key);
}

// Check if a string appears to be in encrypted format
function checkIsEncrypted(text: string): boolean {
  if (!text) return false;

  const parts = text.split(":");
  if (parts.length !== 3) return false;

  const [ivHex, authTagHex] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// Decrypt encrypted text using AES-256-GCM (format: iv:authTag:encryptedData)
function decrypt(encryptedText: string): string {
  if (!encryptedText) return "";

  // If it looks like a JWT (starts with "ey"), it's not encrypted
  if (encryptedText.startsWith("ey")) {
    return encryptedText;
  }

  // Check if the text is actually encrypted
  if (!checkIsEncrypted(encryptedText)) {
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();

    const parts = encryptedText.split(":");
    const [ivHex, authTagHex, encryptedDataHex] = parts;

    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const encryptedData = Buffer.from(encryptedDataHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString("utf8");
  } catch (error) {
    console.error("[Decrypt] Failed:", error);
    return encryptedText;
  }
}

export interface Tenant {
  id: number;
  uuid: string;
  name: string;
  d3_tenant_name?: string | null;
}

export interface TenantWithCredentials extends Tenant {
  supabase_url: string | null;
  supabase_service_key: string | null;
  supabase_anon_key?: string | null;
  d3_tenant_name?: string | null;
}

const TENANT_COOKIE = "selected_tenant";

export async function getTenants(): Promise<Tenant[]> {
  const { data, error } = await supabaseAuth
    .schema("auth_tenant")
    .from("tenants")
    .select("id, uuid, name, d3_tenant_name")
    .eq("status", "active")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching tenants:", error);
    return [];
  }

  return data || [];
}

export async function getSelectedTenant(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE)?.value || null;
}

export async function saveSelectedTenant(formData: FormData): Promise<void> {
  const tenantName = formData.get("tenant") as string;

  if (tenantName) {
    const cookieStore = await cookies();
    cookieStore.set(TENANT_COOKIE, tenantName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  redirect("/");
}

export async function selectTenant(tenantName: string): Promise<void> {
  if (tenantName) {
    const cookieStore = await cookies();
    cookieStore.set(TENANT_COOKIE, tenantName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });
  }

  redirect("/");
}

export async function getTenantCredentials(tenantName: string): Promise<TenantWithCredentials | null> {
  const { data, error } = await supabaseAuth
    .schema("auth_tenant")
    .from("tenants")
    .select("id, uuid, name, supabase_url, supabase_service_key, supabase_anon_key, d3_tenant_name")
    .ilike("name", tenantName)
    .eq("status", "active")
    .is("deleted_at", null)
    .single();

  if (error) {
    console.error("Error fetching tenant credentials:", error);
    return null;
  }

  if (!data) {
    return null;
  }

  // Decrypt the encrypted credentials
  const decryptedServiceKey = data.supabase_service_key ? decrypt(data.supabase_service_key) : null;
  const decryptedAnonKey = data.supabase_anon_key ? decrypt(data.supabase_anon_key) : null;

  // Use service key if available, otherwise fall back to anon key
  const finalKey = decryptedServiceKey || decryptedAnonKey;

  return {
    ...data,
    supabase_service_key: finalKey,
  };
}

export async function getTenantSupabaseClient(): Promise<SupabaseClient | null> {
  // The new Dolese Postgres cluster (DOLESE_PG_URL), when configured, is the single
  // data source for every tenant — short-circuit the per-tenant Supabase lookup.
  const pg = getPgAdapterClient();
  if (pg) return pg as unknown as SupabaseClient;

  console.log("========== [TENANT] Getting Supabase Client ==========");

  let selectedTenant = await getSelectedTenant();
  console.log("[Tenant] Selected tenant from cookie:", selectedTenant);

  // Default to "dolese" if no tenant is selected
  if (!selectedTenant) {
    console.log("[Tenant] No tenant selected, defaulting to dolese");
    selectedTenant = "dolese";
  }

  console.log("[Tenant] Getting credentials for:", selectedTenant);
  const tenant = await getTenantCredentials(selectedTenant);
  console.log("[Tenant] Tenant credentials result:", tenant ? {
    id: tenant.id,
    name: tenant.name,
    hasUrl: !!tenant.supabase_url,
    hasKey: !!tenant.supabase_service_key,
    url: tenant.supabase_url?.substring(0, 30) + "..."
  } : "NULL");

  if (!tenant) {
    console.error("[Tenant] Could not find tenant:", selectedTenant);
    // Fallback to environment variables
    const fallbackUrl = process.env.DOLESE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const fallbackKey = process.env.DOLESE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    console.log("[Tenant] Checking env fallback - hasUrl:", !!fallbackUrl, "hasKey:", !!fallbackKey);
    if (fallbackUrl && fallbackKey) {
      console.log("[Tenant] Using environment variable fallback:", fallbackUrl.substring(0, 30) + "...");
      return createClient(fallbackUrl, fallbackKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    console.error("[Tenant] No fallback available, returning null");
    return null;
  }

  if (!tenant.supabase_url || !tenant.supabase_service_key) {
    console.error("[Tenant] Missing credentials for:", selectedTenant, {
      hasUrl: !!tenant.supabase_url,
      hasKey: !!tenant.supabase_service_key,
    });
    // Fallback to environment variables
    const fallbackUrl = process.env.DOLESE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const fallbackKey = process.env.DOLESE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
    console.log("[Tenant] Checking env fallback - hasUrl:", !!fallbackUrl, "hasKey:", !!fallbackKey);
    if (fallbackUrl && fallbackKey) {
      console.log("[Tenant] Using environment variable fallback:", fallbackUrl.substring(0, 30) + "...");
      return createClient(fallbackUrl, fallbackKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    console.error("[Tenant] No fallback available, returning null");
    return null;
  }

  console.log("[Tenant] SUCCESS - Using tenant database:", selectedTenant, tenant.supabase_url.substring(0, 30) + "...");

  return createClient(tenant.supabase_url, tenant.supabase_service_key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Get the D3 display name for the selected tenant.
 * Returns d3_tenant_name if available, otherwise falls back to the tenant name.
 */
export async function getSelectedTenantDisplayName(): Promise<string> {
  const selectedTenant = await getSelectedTenant();

  if (!selectedTenant) {
    return "DOLESE"; // Default display name
  }

  const tenant = await getTenantCredentials(selectedTenant);

  if (!tenant) {
    return selectedTenant.toUpperCase();
  }

  // Use d3_tenant_name if available, otherwise use the tenant name
  return (tenant.d3_tenant_name || tenant.name || selectedTenant).toUpperCase();
}
