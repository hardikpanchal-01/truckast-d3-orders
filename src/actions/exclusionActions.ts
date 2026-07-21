"use server";

/**
 * Exclusion pattern actions for filtering orders.
 * Matches D3 production logic from truckast-dolese-readymix-frontend.
 */

import supabaseServer from "@/supabase/server";
import { getTenantSupabaseClient, getSelectedTenant } from "@/actions/tenantActions";

export type ExclusionPatternType = "customer" | "product" | "delivery_address";

export interface ExclusionPatterns {
  customers: string[];
  products: string[];
  deliveryAddresses: string[];
}

/**
 * In-memory cache for excluded patterns (server-side), KEYED BY TENANT. Exclusion
 * patterns live in each tenant's own DB, so a single global cache would serve one
 * tenant's patterns to another right after a switch — key by the selected tenant so
 * switching never leaks patterns across tenants.
 */
const patternCache = new Map<string, { patterns: ExclusionPatterns; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all excluded patterns grouped by type, from the SELECTED tenant's DB.
 * Only fetches patterns where affects_counts=true (for summary counts).
 */
export async function getExcludedPatterns(): Promise<ExclusionPatterns> {
  const now = Date.now();
  const tenantKey = (await getSelectedTenant()) || "default";

  // Return cached patterns for THIS tenant if still valid
  const cached = patternCache.get(tenantKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.patterns;
  }

  // Read from the selected tenant's database (not the default server client).
  const supabase = (await getTenantSupabaseClient()) || supabaseServer;

  try {
    // Fetch patterns where affects_counts=true (for summary counts)
    let { data, error } = await supabase
      .from("excluded_order_patterns")
      .select("type, pattern")
      .eq("active", true)
      .eq("affects_counts", true);

    // Graceful fallback if affects_counts column doesn't exist
    if (error && /affects_counts/.test(error.message || "")) {
      console.warn(
        "[getExcludedPatterns] affects_counts column missing — falling back to full pattern set."
      );
      const fallback = await supabase
        .from("excluded_order_patterns")
        .select("type, pattern")
        .eq("active", true);
      data = fallback.data;
      error = fallback.error;
    }

    if (error) {
      console.error("[ERROR] getExcludedPatterns:", error.message);
      return { customers: [], products: [], deliveryAddresses: [] };
    }

    // Group patterns by type
    const customers: string[] = [];
    const products: string[] = [];
    const deliveryAddresses: string[] = [];

    (data || []).forEach((item) => {
      switch (item.type) {
        case "customer":
          customers.push(item.pattern);
          break;
        case "product":
          products.push(item.pattern);
          break;
        case "delivery_address":
          deliveryAddresses.push(item.pattern);
          break;
      }
    });

    const patterns = { customers, products, deliveryAddresses };

    // Cache the patterns for this tenant
    patternCache.set(tenantKey, { patterns, timestamp: now });

    return patterns;
  } catch (error) {
    console.error("[ERROR] getExcludedPatterns:", error);
    return { customers: [], products: [], deliveryAddresses: [] };
  }
}

/**
 * Invalidates the pattern cache
 */
export async function invalidatePatternCache(): Promise<void> {
  patternCache.clear();
}
