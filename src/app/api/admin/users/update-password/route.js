export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import {
  updatePasswordInAuthDb,
  updatePasswordInAllTenants,
} from "@/services/user-sync-service";

/**
 * API endpoint for updating user password.
 * Updates password in:
 * 1. Current tenant's Supabase (Main DB)
 * 2. Central Auth DB
 * 3. All other tenants where user exists
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, email, password } = body;

    if (!userId) {
      return Response.json(
        { success: false, error: "User ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!password) {
      return Response.json(
        { success: false, error: "Password is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Password validation
    if (password.length < 6) {
      return Response.json(
        { success: false, error: "Password must be at least 6 characters" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get environment variables for current tenant
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[PASSWORD UPDATE] Supabase credentials not configured");
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[PASSWORD UPDATE] ========== Starting ==========");
    console.log("[PASSWORD UPDATE] User ID:", userId);
    console.log("[PASSWORD UPDATE] Email:", email);

    // Step 1: Update password in Main DB (current tenant)
    console.log("[PASSWORD UPDATE] Step 1: Updating password in Main DB...");
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // First, verify the user exists and get their email if not provided
    let userEmail = email;
    if (!userEmail) {
      const { data: userData, error: userError } =
        await supabaseAdmin.auth.admin.getUserById(userId);

      if (userError || !userData?.user) {
        console.error("[PASSWORD UPDATE] User not found:", userError?.message);
        return Response.json(
          { success: false, error: "User not found" },
          { status: 404, headers: { "cache-control": "no-store" } }
        );
      }
      userEmail = userData.user.email;
    }

    // Update password in current tenant
    const { error: updateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: password,
        email_confirm: true,
      });

    if (updateError) {
      console.error(
        "[PASSWORD UPDATE] Main DB update failed:",
        updateError.message
      );
      return Response.json(
        { success: false, error: updateError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[PASSWORD UPDATE] Main DB password updated successfully");

    // Step 2: Sync to Auth DB (central authentication database)
    console.log("[PASSWORD UPDATE] Step 2: Syncing to Auth DB...");
    const authDbResult = await updatePasswordInAuthDb(userEmail, password);

    if (!authDbResult.success) {
      console.warn(
        "[PASSWORD UPDATE] Auth DB sync failed:",
        authDbResult.error
      );
      // Don't fail the request - main DB is already updated
    } else {
      console.log("[PASSWORD UPDATE] Auth DB sync successful");
    }

    // Step 3: Sync to all other tenants
    console.log("[PASSWORD UPDATE] Step 3: Syncing to all tenants...");
    const crossTenantResult = await updatePasswordInAllTenants(
      userEmail,
      password,
      supabaseUrl // Skip current tenant
    );

    console.log("[PASSWORD UPDATE] ========== Complete ==========");
    console.log(
      "[PASSWORD UPDATE] Updated tenants:",
      crossTenantResult.updatedTenants
    );
    console.log(
      "[PASSWORD UPDATE] Errors:",
      crossTenantResult.errors
    );

    // Build response message
    let message = "Password updated successfully";
    if (crossTenantResult.updatedTenants.length > 0) {
      message += ` (synced to ${crossTenantResult.updatedTenants.length} other tenant${crossTenantResult.updatedTenants.length > 1 ? "s" : ""})`;
    }

    return Response.json(
      {
        success: true,
        message: message,
        details: {
          mainDbUpdated: true,
          authDbUpdated: authDbResult.success,
          crossTenantSync: {
            updatedTenants: crossTenantResult.updatedTenants,
            errors: crossTenantResult.errors,
          },
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/update-password:", error);
    return Response.json(
      { success: false, error: "Failed to update password" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
