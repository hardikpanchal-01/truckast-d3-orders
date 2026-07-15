import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

// Available app permissions - permission_code values stored in user_app_permissions table
const APP_PERMISSIONS = [
  { id: "orders", name: "ORDER REQUEST", permission_code: "orders" },
  { id: "truckast", name: "TRUCKAST", permission_code: "truckast" }
];

/**
 * GET /api/admin/users/[userId]/apps
 * Get apps and user's access for each app from user_app_permissions table
 */
export async function GET(request, { params }) {
  const { userId } = await params;

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { success: false, error: "No tenant database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get user's app permissions from user_app_permissions table
    const { data: permissions, error: permError } = await supabase
      .from("user_app_permissions")
      .select("*")
      .eq("user_id", userId);

    console.log("[Apps API] User ID:", userId);
    console.log("[Apps API] Raw permissions from DB:", JSON.stringify(permissions));

    if (permError) {
      console.error("[Apps API] Error fetching permissions:", permError);
    }

    const userPermissions = (permissions || []).map(p => p.permission_code);
    console.log("[Apps API] Permission codes:", userPermissions);

    // Build apps list with access status
    const apps = APP_PERMISSIONS.map(app => ({
      id: app.id,
      name: app.name,
      permission_code: app.permission_code,
      has_access: userPermissions.includes(app.permission_code)
    }));

    return Response.json(
      { success: true, apps, user: { id: user.id, name: user.full_name } },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/users/[userId]/apps:", error);
    return Response.json(
      { success: false, error: "Failed to get user apps" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/apps
 * Update user's app access in user_app_permissions table
 */
export async function POST(request, { params }) {
  const { userId } = await params;

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const body = await request.json();
    const selectedApps = body.apps || [];

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { success: false, error: "No tenant database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get valid permission codes from our list
    const validPermissionCodes = APP_PERMISSIONS.map(app => app.permission_code);

    // Delete existing app permissions for this user (only the ones we manage)
    const { error: deleteError } = await supabase
      .from("user_app_permissions")
      .delete()
      .eq("user_id", userId)
      .in("permission_code", validPermissionCodes);

    if (deleteError) {
      console.error("[Apps API] Delete error:", deleteError);
      return Response.json(
        { success: false, error: "Failed to update app access" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // Insert new app permissions
    if (selectedApps.length > 0) {
      // Filter to only valid permission codes
      const permissionsToInsert = selectedApps
        .filter(appId => validPermissionCodes.includes(appId))
        .map(permissionCode => ({
          user_id: userId,
          permission_code: permissionCode
        }));

      if (permissionsToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("user_app_permissions")
          .insert(permissionsToInsert);

        if (insertError) {
          console.error("[Apps API] Insert error:", insertError);
          return Response.json(
            { success: false, error: "Failed to update app access" },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
      }
    }

    return Response.json(
      { success: true, message: "App access updated successfully" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] POST /api/admin/users/[userId]/apps:", error);
    return Response.json(
      { success: false, error: "Failed to update user apps" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
