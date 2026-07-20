import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    // Get user details and current order_tile_access status
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("full_name, order_tile_access")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Toggle order_tile_access
    const newValue = !user.order_tile_access;
    const { error: updateError } = await supabase
      .from("users")
      .update({ order_tile_access: newValue })
      .eq("id", userId);

    if (updateError) {
      console.error("[ERROR] Order tile toggle:", updateError);
      return NextResponse.json({ success: false, error: "Failed to toggle order tile access" }, { status: 500 });
    }

    console.log(`[ORDER TILE] User ${user.full_name} (${userId}) order tile access: ${newValue}`);

    return NextResponse.json({ success: true, order_tile_access: newValue });
  } catch (error) {
    console.error("[ERROR] Toggle order tile:", error);
    return NextResponse.json({ success: false, error: "Failed to toggle order tile access" }, { status: 500 });
  }
}
