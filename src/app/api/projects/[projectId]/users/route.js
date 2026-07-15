import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects/[projectId]/users
 * Add or remove users from a project
 * Body: { add: [userId, ...], remove: [userId, ...] }
 */
export async function POST(request, { params }) {
  const { projectId } = await params;

  if (!projectId) {
    return Response.json(
      { success: false, error: "Project ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const body = await request.json();
    const { add = [], remove = [] } = body;

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { success: false, error: "No tenant database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    let addedCount = 0;
    let removedCount = 0;

    // Remove users from project
    if (remove.length > 0) {
      const { error: removeError, count } = await supabase
        .from("user_projects")
        .delete()
        .eq("project_id", projectId)
        .in("user_id", remove);

      if (removeError) {
        console.error("[Project Users API] Error removing users:", removeError);
        return Response.json(
          { success: false, error: "Failed to remove users: " + removeError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }
      removedCount = count || remove.length;
    }

    // Add users to project
    if (add.length > 0) {
      // Get project's customer_id first
      const { data: projectData } = await supabase
        .from("projects")
        .select("customer_id")
        .eq("id", projectId)
        .maybeSingle();

      const customerId = projectData?.customer_id || null;

      // Check which users already have access
      const { data: existingAccess } = await supabase
        .from("user_projects")
        .select("user_id")
        .eq("project_id", projectId)
        .in("user_id", add);

      const existingUserIds = new Set((existingAccess || []).map(e => String(e.user_id)));
      const newUserIds = add.filter(id => !existingUserIds.has(String(id)));

      if (newUserIds.length > 0) {
        const insertData = newUserIds.map(userId => ({
          project_id: projectId,
          user_id: userId,
          customer_id: customerId
        }));

        const { error: addError } = await supabase
          .from("user_projects")
          .insert(insertData);

        if (addError) {
          console.error("[Project Users API] Error adding users:", addError);
          return Response.json(
            { success: false, error: "Failed to add users: " + addError.message },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
        addedCount = newUserIds.length;
      }
    }

    return Response.json(
      {
        success: true,
        message: `Added ${addedCount} user(s), removed ${removedCount} user(s)`,
        added: addedCount,
        removed: removedCount
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] POST /api/projects/[projectId]/users:", error);
    return Response.json(
      { success: false, error: "Failed to update project users" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
