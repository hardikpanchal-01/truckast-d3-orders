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

    // Get user details and current forced_logout status
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("full_name, forced_logout")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Toggle forced_logout
    const newValue = !user.forced_logout;
    const { error: updateError } = await supabase
      .from("users")
      .update({ forced_logout: newValue })
      .eq("id", userId);

    if (updateError) {
      console.error("[ERROR] Forced logout toggle:", updateError);
      return NextResponse.json({ success: false, error: "Failed to toggle forced logout" }, { status: 500 });
    }

    console.log(`[FORCED LOGOUT] User ${user.full_name} (${userId}) forced logout: ${newValue}`);

    return NextResponse.json({ success: true, forced_logout: newValue });
  } catch (error) {
    console.error("[ERROR] Toggle forced logout:", error);
    return NextResponse.json({ success: false, error: "Failed to toggle forced logout" }, { status: 500 });
  }
}
