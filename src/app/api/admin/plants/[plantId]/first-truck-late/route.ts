import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET - Fetch plant first truck late settings
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params;

    // Get tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    const supabase = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get plant data - only select columns that exist
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("id, code, description, short_description")
      .eq("id", plantId)
      .single();

    if (plantError || !plant) {
      console.error("[ERROR] Get plant:", plantError?.message);
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }

    // Try to get first truck late from plant_first_truck_late table
    let firstTruckLate: number | null = null;
    let truckStatus = false;

    try {
      const { data: truckData } = await supabase
        .from("plant_first_truck_late")
        .select("time_in_minutes, status")
        .eq("plant_id", plantId)
        .single();

      if (truckData) {
        firstTruckLate = truckData.time_in_minutes;
        truckStatus = truckData.status === true;
      }
    } catch {
      // Table might not exist, continue without error
      console.log("[FIRST TRUCK LATE] plant_first_truck_late table not found, returning defaults");
    }

    return NextResponse.json({
      id: plant.id,
      code: plant.code,
      name: plant.description || plant.short_description || plant.code,
      first_truck_late: firstTruckLate,
      truck_status: truckStatus,
    });
  } catch (error) {
    console.error("[ERROR] Get first truck late:", error);
    return NextResponse.json({ error: "Failed to get plant data" }, { status: 500 });
  }
}

/**
 * POST - Update plant first truck late settings
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ plantId: string }> }
) {
  try {
    const { plantId } = await params;
    const body = await request.json();

    // Get tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const supabase = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse the time in minutes value
    let timeInMinutes: number | null = null;
    if (body.first_truck_late !== null && body.first_truck_late !== undefined && body.first_truck_late !== "") {
      const parsed = parseInt(String(body.first_truck_late), 10);
      if (!isNaN(parsed)) {
        timeInMinutes = parsed;
      }
    }

    const plantIdNum = parseInt(plantId, 10);
    const now = new Date().toISOString();

    // Try to upsert to plant_first_truck_late table
    try {
      const { error: upsertError } = await supabase
        .from("plant_first_truck_late")
        .upsert(
          {
            plant_id: plantIdNum,
            time_in_minutes: timeInMinutes,
            status: body.truck_status === true,
            updated_at: now,
          },
          {
            onConflict: "plant_id",
          }
        );

      if (upsertError) {
        console.error("[ERROR] Upsert first truck late:", upsertError.message);
        return NextResponse.json({ success: false, error: "Failed to save settings: " + upsertError.message }, { status: 500 });
      }
    } catch (tableError) {
      console.error("[ERROR] Table error:", tableError);
      return NextResponse.json({ success: false, error: "Table not configured" }, { status: 500 });
    }

    console.log(`[FIRST TRUCK LATE] Updated plant ${plantId}: ${timeInMinutes} minutes`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ERROR] Update first truck late:", error);
    return NextResponse.json({ success: false, error: "Failed to update settings" }, { status: 500 });
  }
}
