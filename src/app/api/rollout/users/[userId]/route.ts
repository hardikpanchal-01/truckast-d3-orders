import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/rollout/users/[userId]
 * Returns user details for the rollout user details page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get user details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, email, phone_number, invitation_sent_at")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      console.error("[ERROR] Get user:", userError?.message);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get primary customer (first assignment) for the "INVITE MORE FROM" tile
    let customer_id: number | null = null;
    let customer_name: string | null = null;
    const { data: link } = await supabase
      .from("user_customers")
      .select("customer_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (link?.customer_id) {
      customer_id = link.customer_id;
      const { data: c } = await supabase
        .from("customers")
        .select("name")
        .eq("id", link.customer_id)
        .maybeSingle();
      customer_name = c?.name ?? null;
    }

    // Format reinvited date
    const d = user.invitation_sent_at ? new Date(user.invitation_sent_at) : null;
    const reinvited_date =
      d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : null;

    return NextResponse.json({
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone_number,
      customer_id,
      customer_name,
      reinvited_date,
      forced_logout: false,
      order_tile_access: false,
    });
  } catch (error) {
    console.error("[ERROR] Get user details:", error);
    return NextResponse.json({ error: "Failed to load user details" }, { status: 500 });
  }
}
