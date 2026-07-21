export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";
import { NextRequest } from "next/server";

/**
 * API endpoint for getting a single plant by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params;

    if (!plantId) {
      return Response.json(
        { success: false, error: "Plant ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

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

    // Get plant by ID
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("*")
      .eq("id", plantId)
      .single();

    if (plantError) {
      console.error("[PLANT] Error fetching plant:", plantError.message);
      return Response.json(
        { success: false, error: plantError.message },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    if (!plant) {
      return Response.json(
        { success: false, error: "Plant not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Parse address fields
    const address = plant.address1 || "";
    const city = plant.address2 || "";

    // Parse address3 which contains "STATE ZIPCODE" (e.g., "OK 74108")
    let state = "";
    let zipcode = "";
    if (plant.address3) {
      const parts = plant.address3.trim().split(/\s+/);
      if (parts.length >= 2) {
        state = parts[0];
        zipcode = parts.slice(1).join(" ");
      } else if (parts.length === 1) {
        if (/^\d/.test(parts[0])) {
          zipcode = parts[0];
        } else {
          state = parts[0];
        }
      }
    }

    // Format the plant data
    const plantData = {
      id: plant.id,
      code: plant.code || "",
      name: plant.description || plant.short_description || plant.code || "",
      address: address,
      city: city,
      state: state,
      country: state ? "United States" : "",
      zipcode: zipcode,
      phone: plant.phone || "",
      latitude: plant.latitude || "",
      longitude: plant.longitude || "",
      region_id: plant.region_id,
    };

    return Response.json(
      { success: true, data: plantData },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/plants/[plantId]:", error);
    return Response.json(
      { success: false, error: "Failed to get plant" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * API endpoint for updating a plant
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params;

    if (!plantId) {
      return Response.json(
        { success: false, error: "Plant ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const body = await request.json();

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

    // Build address3 from state and zipcode
    let address3 = "";
    if (body.state || body.zipcode) {
      address3 = [body.state, body.zipcode].filter(Boolean).join(" ");
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {
      code: body.code,
      description: body.name,
      address1: body.address,
      address2: body.city,
      address3: address3,
      phone: body.phone,
      latitude: body.latitude ? parseFloat(body.latitude) : null,
      longitude: body.longitude ? parseFloat(body.longitude) : null,
    };

    // Update plant
    const { data: updatedPlant, error: updateError } = await supabase
      .from("plants")
      .update(updateData)
      .eq("id", plantId)
      .select()
      .single();

    if (updateError) {
      console.error("[PLANT] Error updating plant:", updateError.message);
      return Response.json(
        { success: false, error: updateError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[PLANT] Updated plant:", plantId);

    return Response.json(
      { success: true, data: updatedPlant },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] PUT /api/admin/plants/[plantId]:", error);
    return Response.json(
      { success: false, error: "Failed to update plant" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
