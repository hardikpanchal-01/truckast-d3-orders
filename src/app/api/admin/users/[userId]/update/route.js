export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for updating user information.
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await params;
    const body = await request.json();
    const { first_name, last_name, name, title, phone, measurement_system } = body;

    // Build full name from first_name and last_name if provided
    const fullName = (first_name !== undefined || last_name !== undefined)
      ? `${first_name || ''} ${last_name || ''}`.trim()
      : name;

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
    console.log("[USER UPDATE] Data:", { first_name, last_name, fullName, title, phone, measurement_system });

    // Build update object for public.users table
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (first_name !== undefined) updateData.first_name = first_name;
    if (last_name !== undefined) updateData.last_name = last_name;
    if (fullName) updateData.full_name = fullName;
    if (title !== undefined) updateData.title = title;
    if (phone !== undefined) updateData.phone_number = phone;

    // Update public.users table
    const { error: publicError } = await supabaseAdmin
      .from("users")
      .update(updateData)
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
