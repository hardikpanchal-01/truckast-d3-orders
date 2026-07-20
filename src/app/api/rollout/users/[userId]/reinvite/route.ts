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

    // Get user details
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", userId)
      .single();

    if (userError || !user) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Update invitation_sent_at timestamp
    const { error: updateError } = await supabase
      .from("users")
      .update({ invitation_sent_at: new Date().toISOString() })
      .eq("id", userId);

    if (updateError) {
      console.error("[ERROR] Reinvite update:", updateError);
      return NextResponse.json({ success: false, error: "Failed to reinvite user" }, { status: 500 });
    }

    // TODO: Send actual invitation email
    console.log(`[REINVITE] User ${user.full_name} (${userId}) reinvited`);

    return NextResponse.json({ success: true, message: "User reinvited successfully" });
  } catch (error) {
    console.error("[ERROR] Reinvite user:", error);
    return NextResponse.json({ success: false, error: "Failed to reinvite user" }, { status: 500 });
  }
}
