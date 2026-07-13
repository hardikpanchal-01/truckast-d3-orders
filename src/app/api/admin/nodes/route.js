export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for listing nodes/organizations for role assignment.
 */

// Regions in display order (matching D3)
const REGIONS = [
  { id: "region-dolese", name: "DOLESE" },
  { id: "region-eastern", name: "EASTERN" },
  { id: "region-northern", name: "NORTHERN" },
  { id: "region-okc-metro", name: "OKC METRO" },
  { id: "region-southeastern", name: "SOUTHEASTERN" },
  { id: "region-southwestern", name: "SOUTHWESTERN" },
  { id: "region-tulsa", name: "TULSA" },
  { id: "region-western", name: "WESTERN" },
  { id: "region-piedmont", name: "PIEDMONT" },
];

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get plants from plants table
    const { data: plantsData, error: plantsError } = await supabase
      .from("plants")
      .select("code, description, short_description")
      .order("description", { ascending: true });

    if (plantsError) {
      console.warn("[NODES] Error fetching plants:", plantsError.message);
    }

    // Format the plants data
    const plants = (plantsData || []).map((plant) => ({
      id: plant.code,
      name: plant.description || plant.short_description || plant.code,
    }));

    // Combine: Regions first, then Plants
    const nodes = [...REGIONS, ...plants];

    console.log("[NODES] Found", REGIONS.length, "regions and", plants.length, "plants");

    return Response.json(
      { success: true, data: nodes },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/nodes:", error);
    return Response.json(
      { success: false, error: "Failed to get nodes" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
