import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

// Month names for mapping
const MONTH_NAMES = [
  "", "jan", "feb", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

// Status type mapping: 0 = Low/Moderate Risk, 1 = High Risk
const STATUS_TO_RISK: Record<number, string> = {
  0: "",
  1: "High Risk"
};

const RISK_TO_STATUS: Record<string, number> = {
  "": 0,
  "Low Risk": 0,
  "Moderate Risk": 0,
  "High Risk": 1
};

/**
 * GET - Fetch plant temperature settings from plant_monthly_configurations
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

    // Get plant data
    const { data: plant, error: plantError } = await supabase
      .from("plants")
      .select("id, code, description, short_description")
      .eq("id", plantId)
      .single();

    if (plantError || !plant) {
      console.error("[ERROR] Get plant:", plantError?.message);
      return NextResponse.json({ error: "Plant not found" }, { status: 404 });
    }

    // Get monthly configurations
    const { data: configs, error: configError } = await supabase
      .from("plant_monthly_configurations")
      .select("month_number, temperature_value, status_type, concrete_temperature_value")
      .eq("plant_id", plantId)
      .order("month_number", { ascending: true });

    if (configError) {
      console.error("[ERROR] Get monthly configs:", configError.message);
    }

    console.log(`[PLANT TEMP] Plant ${plantId} - Found ${configs?.length || 0} monthly configs:`, configs);

    // Build response with monthly data
    const monthlyData: Record<string, number | string | null> = {};

    // Initialize all months with defaults
    for (let m = 1; m <= 12; m++) {
      const monthKey = MONTH_NAMES[m];
      monthlyData[monthKey] = 75; // Default temperature
      monthlyData[`${monthKey}_risk`] = "";
      monthlyData[`${monthKey}_concrete`] = null;
    }

    // Fill in actual data from configurations
    if (configs && configs.length > 0) {
      for (const config of configs) {
        const monthKey = MONTH_NAMES[config.month_number];
        if (monthKey) {
          monthlyData[monthKey] = config.temperature_value ?? 75;
          monthlyData[`${monthKey}_risk`] = STATUS_TO_RISK[config.status_type] || "";
          monthlyData[`${monthKey}_concrete`] = config.concrete_temperature_value;
        }
      }
    }

    // Get July temperature for title display
    const julyTemp = monthlyData.july ?? 75;

    return NextResponse.json({
      id: plant.id,
      code: plant.code,
      name: plant.description || plant.short_description || plant.code,
      // Monthly temperatures
      jan: monthlyData.jan,
      feb: monthlyData.feb,
      march: monthlyData.march,
      april: monthlyData.april,
      may: monthlyData.may,
      june: monthlyData.june,
      july: julyTemp,
      august: monthlyData.august,
      september: monthlyData.september,
      october: monthlyData.october,
      november: monthlyData.november,
      december: monthlyData.december,
      // Monthly risk levels
      jan_risk: monthlyData.jan_risk,
      feb_risk: monthlyData.feb_risk,
      march_risk: monthlyData.march_risk,
      april_risk: monthlyData.april_risk,
      may_risk: monthlyData.may_risk,
      june_risk: monthlyData.june_risk,
      july_risk: monthlyData.july_risk,
      august_risk: monthlyData.august_risk,
      september_risk: monthlyData.september_risk,
      october_risk: monthlyData.october_risk,
      november_risk: monthlyData.november_risk,
      december_risk: monthlyData.december_risk,
    });
  } catch (error) {
    console.error("[ERROR] Get plant temperature:", error);
    return NextResponse.json({ error: "Failed to get plant temperature" }, { status: 500 });
  }
}

/**
 * POST - Update plant temperature settings in plant_monthly_configurations
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

    // Parse temperature values
    const parseTemp = (val: string | number | null | undefined): number => {
      if (val === null || val === undefined || val === "") return 0;
      const num = parseFloat(String(val));
      return isNaN(num) ? 0 : num;
    };

    // Map month names to body keys
    const monthBodyKeys: Record<number, { temp: string; risk: string }> = {
      1: { temp: "jan", risk: "jan_risk" },
      2: { temp: "feb", risk: "feb_risk" },
      3: { temp: "march", risk: "march_risk" },
      4: { temp: "april", risk: "april_risk" },
      5: { temp: "may", risk: "may_risk" },
      6: { temp: "june", risk: "june_risk" },
      7: { temp: "july", risk: "july_risk" },
      8: { temp: "august", risk: "august_risk" },
      9: { temp: "september", risk: "september_risk" },
      10: { temp: "october", risk: "october_risk" },
      11: { temp: "november", risk: "november_risk" },
      12: { temp: "december", risk: "december_risk" },
    };

    // Upsert each month's configuration
    const plantIdNum = parseInt(plantId, 10);
    const now = new Date().toISOString();

    for (let month = 1; month <= 12; month++) {
      const keys = monthBodyKeys[month];
      const tempValue = parseTemp(body[keys.temp]);
      const riskValue = body[keys.risk] || "";
      const statusType = RISK_TO_STATUS[riskValue] ?? 0;

      // Upsert using the unique constraint (plant_id, month_number)
      const { error: upsertError } = await supabase
        .from("plant_monthly_configurations")
        .upsert(
          {
            plant_id: plantIdNum,
            month_number: month,
            temperature_value: tempValue,
            status_type: statusType,
            updated_at: now,
          },
          {
            onConflict: "plant_id,month_number",
          }
        );

      if (upsertError) {
        console.error(`[ERROR] Upsert month ${month}:`, upsertError.message);
        return NextResponse.json({
          success: false,
          error: `Failed to save month ${month}: ${upsertError.message}`
        }, { status: 500 });
      }
    }

    console.log(`[PLANT TEMPERATURE] Updated plant ${plantId} monthly configurations`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ERROR] Update plant temperature:", error);
    return NextResponse.json({ success: false, error: "Failed to update temperature settings" }, { status: 500 });
  }
}
