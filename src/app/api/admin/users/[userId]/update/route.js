export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for updating user information.
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { name, title, phone, measurement_system } = body;

    if (!userId) {
      return Response.json(
        { success: false, error: "User ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[USER UPDATE] Supabase credentials not configured");
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("[USER UPDATE] Updating user:", userId);
    console.log("[USER UPDATE] Data:", { name, title, phone, measurement_system });

    // Update user metadata in auth.users
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          full_name: name,
          title: title,
          phone: phone,
          measurement_system: measurement_system,
        },
      }
    );

    if (authError) {
      console.error("[USER UPDATE] Auth update error:", authError.message);
      return Response.json(
        { success: false, error: authError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // Also update public.users table if it exists
    const { error: publicError } = await supabaseAdmin
      .from("users")
      .update({
        full_name: name,
        title: title,
        phone_number: phone,
        measurement_system: measurement_system,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (publicError) {
      console.warn("[USER UPDATE] Public users update warning:", publicError.message);
      // Don't fail - auth update is more important
    }

    console.log("[USER UPDATE] User updated successfully");

    return Response.json(
      {
        success: true,
        message: "User information updated successfully",
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/[userId]/update:", error);
    return Response.json(
      { success: false, error: "Failed to update user" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
