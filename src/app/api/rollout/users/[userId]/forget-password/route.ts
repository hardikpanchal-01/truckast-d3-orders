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

    if (!user.email) {
      return NextResponse.json({ success: false, error: "User has no email" }, { status: 400 });
    }

    // TODO: Implement actual password reset via auth provider
    console.log(`[PASSWORD RESET] Sending reset email to ${user.full_name} at ${user.email}`);

    return NextResponse.json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    console.error("[ERROR] Forget password:", error);
    return NextResponse.json({ success: false, error: "Failed to send password reset" }, { status: 500 });
  }
}
