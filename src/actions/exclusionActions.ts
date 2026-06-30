"use server";

/**
 * Exclusion pattern actions for filtering orders.
 * Matches D3 production logic from truckast-dolese-readymix-frontend.
 */

import supabaseServer from "@/supabase/server";

export type ExclusionPatternType = "customer" | "product" | "delivery_address";

export interface ExclusionPatterns {
  customers: string[];
  products: string[];
  deliveryAddresses: string[];
}

/**
 * In-memory cache for excluded patterns (server-side)
 */
let patternCache: { patterns: ExclusionPatterns; timestamp: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all excluded patterns grouped by type.
 * Only fetches patterns where affects_counts=true (for summary counts).
 */
export async function getExcludedPatterns(): Promise<ExclusionPatterns> {
  const now = Date.now();

  // Return cached patterns if still valid
  if (patternCache && now - patternCache.timestamp < CACHE_TTL_MS) {
    return patternCache.patterns;
  }

  try {
    // Fetch patterns where affects_counts=true (for summary counts)
    let { data, error } = await supabaseServer
      .from("excluded_order_patterns")
      .select("type, pattern")
      .eq("active", true)
      .eq("affects_counts", true);

    // Graceful fallback if affects_counts column doesn't exist
    if (error && /affects_counts/.test(error.message || "")) {
      console.warn(
        "[getExcludedPatterns] affects_counts column missing — falling back to full pattern set."
      );
      const fallback = await supabaseServer
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

    // Cache the patterns
    patternCache = { patterns, timestamp: now };

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
  patternCache = null;
}
