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

    // Get user details first
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Update user to disabled status
    const { error: updateError } = await supabase
      .from("users")
      .update({ disabled: true, disabled_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[ERROR] Disable user update:", updateError);
      return NextResponse.json({ success: false, error: "Failed to disable user" }, { status: 500 });
    }

    console.log(`[DISABLE] User ${user.full_name} (${userId}) disabled`);

    return NextResponse.json({ success: true, message: "User disabled successfully" });
  } catch (error) {
    console.error("[ERROR] Disable user:", error);
    return NextResponse.json({ success: false, error: "Failed to disable user" }, { status: 500 });
  }
}
