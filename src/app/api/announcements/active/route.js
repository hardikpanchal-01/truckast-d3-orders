import { NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/announcements/active
 * Active published announcements for the SELECTED tenant, read from that tenant's
 * database (the same Postgres source the rest of the app uses — NOT the per-tenant
 * Supabase project, whose URLs can be dead / unreachable). A tenant whose DB has no
 * `announcements` table simply gets an empty list (no promo tile) instead of a 500,
 * which the market page treats as "no announcements" — matching the orders page.
 */
export async function GET() {
  try {
    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: true, data: [] });
    }

    const today = new Date().toISOString().split("T")[0];

    // select("*") so we never fail on a column a given tenant's table happens to lack;
    // the client picks the fields it needs (id, tagline, title, subtitle, color, icon_or_percent).
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .eq("is_published", true)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false });

    if (error) {
      // Missing table / column for this tenant → no announcements, not an error.
      console.warn("[announcements/active] no announcements for tenant:", error.message);
      return NextResponse.json({ success: true, data: [] });
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.warn("[announcements/active] error:", error?.message || error);
    return NextResponse.json({ success: true, data: [] });
  }
}
