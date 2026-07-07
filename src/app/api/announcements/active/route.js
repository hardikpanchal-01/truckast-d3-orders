import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/announcements/active
 * Returns announcements that are:
 * - is_published = true
 * - Current date is between start_date and end_date
 */
export async function GET() {
  try {
    // Get selected tenant, default to Dolese Ready Mix
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    // Get tenant credentials and create client
    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return NextResponse.json({ success: false, error: "Could not connect to tenant database" }, { status: 500 });
    }

    const tenantClient = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get current date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];

    // Fetch active published announcements
    const { data: announcements, error } = await tenantClient
      .from("announcements")
      .select("id, name, tagline, title, subtitle, icon_or_percent, color, start_date, end_date, is_published")
      .eq("is_published", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching active announcements:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: announcements || []
    });
  } catch (error) {
    console.error("Error in GET /api/announcements/active:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
