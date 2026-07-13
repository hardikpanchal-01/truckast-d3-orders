export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

/**
 * API endpoint for listing plants for admin management.
 */

export async function GET() {
  try {
    // Get selected tenant and create tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return Response.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get plants from plants table
    const { data: plantsData, error: plantsError } = await supabase
      .from("plants")
      .select("*")
      .order("description", { ascending: true });

    // Get regions for mapping (regions are in tenant database)
    let regionsMap = {};
    const { data: regionsData, error: regionsError } = await supabase
      .from("regions")
      .select("id, code, description");

    if (regionsError) {
      console.error("[PLANTS] Regions error:", regionsError.message);
    }

    if (regionsData && regionsData.length > 0) {
      console.log("[PLANTS] Found", regionsData.length, "regions");
      console.log("[PLANTS] Sample region:", regionsData[0]);
      regionsData.forEach(r => {
        // Use description as region name, fallback to code
        regionsMap[r.id] = r.description || r.code || "";
      });
    }

    if (plantsError) {
      console.error("[PLANTS] Error fetching plants:", plantsError.message);
      return Response.json(
        { success: false, error: plantsError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[PLANTS] Regions map:", regionsMap);

    // Format the plants data to match D3 columns
    const plants = (plantsData || []).map((plant, index) => {
      // Address fields
      const address = plant.address1 || "";
      const city = plant.address2 || "";

      // Parse address3 which contains "STATE ZIPCODE" (e.g., "OK 74108")
      let state = "";
      let zipcode = "";
      if (plant.address3) {
        const parts = plant.address3.trim().split(/\s+/);
        if (parts.length >= 2) {
          // First part is state, rest is zipcode
          state = parts[0];
          zipcode = parts.slice(1).join(" ");
        } else if (parts.length === 1) {
          // Could be just state or just zipcode
          if (/^\d/.test(parts[0])) {
            zipcode = parts[0];
          } else {
            state = parts[0];
          }
        }
      }

      // Country - default to "United States" if we have state
      const country = state ? "United States" : "";

      return {
        index: index + 1,
        id: plant.id,
        code: plant.code || "",
        name: plant.description || plant.short_description || plant.code || "",
        address: address,
        city: city,
        state: state,
        country: country,
        zipcode: zipcode,
        region: regionsMap[plant.region_id] || "",
        region_id: plant.region_id,
        longitude: plant.longitude || "",
        latitude: plant.latitude || "",
        evaporation_july: plant.evaporation_july ?? null,
        first_truck_late: plant.first_truck_late || null,
      };
    });

    console.log("[PLANTS] Found", plants.length, "plants");

    return Response.json(
      { success: true, data: plants },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/plants:", error);
    return Response.json(
      { success: false, error: "Failed to get plants" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
