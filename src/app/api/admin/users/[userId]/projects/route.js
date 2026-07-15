import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[userId]/projects
 * Get all projects the user has access to
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

    // Get user's projects with project details
    const { data: userProjects, error: projectsError } = await supabase
      .from("user_projects")
      .select(`
        project_id,
        projects (
          id,
          code,
          name,
          customer_id,
          customers (
            id,
            code,
            name
          )
        )
      `)
      .eq("user_id", userId);

    if (projectsError) {
      console.error("[Projects API] Error fetching user projects:", projectsError);
      return Response.json(
        { success: false, error: projectsError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const projects = (userProjects || [])
      .filter(up => up.projects)
      .map(up => ({
        id: String(up.projects.id),
        code: up.projects.code || "",
        name: up.projects.name || "",
        customer_id: up.projects.customer_id ? String(up.projects.customer_id) : "",
        customer_code: up.projects.customers?.code || "",
        customer_name: up.projects.customers?.name || ""
      }));

    return Response.json(
      { success: true, projects },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/users/[userId]/projects:", error);
    return Response.json(
      { success: false, error: "Failed to get user projects" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/projects
 * Add or remove projects from user
 * Body: { add: [projectId, ...], remove: [projectId, ...] }
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

    // Remove projects
    if (remove.length > 0) {
      const { error: removeError, count } = await supabase
        .from("user_projects")
        .delete()
        .eq("user_id", userId)
        .in("project_id", remove);

      if (removeError) {
        console.error("[Projects API] Error removing projects:", removeError);
        return Response.json(
          { success: false, error: "Failed to remove projects: " + removeError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }
      removedCount = count || remove.length;
    }

    // Add projects
    if (add.length > 0) {
      // First check which projects user already has access to
      const { data: existingAccess } = await supabase
        .from("user_projects")
        .select("project_id")
        .eq("user_id", userId)
        .in("project_id", add);

      const existingProjectIds = new Set((existingAccess || []).map(e => String(e.project_id)));

      // Only add projects that don't already exist
      const newProjectIds = add.filter(id => !existingProjectIds.has(String(id)));

      if (newProjectIds.length > 0) {
        // Get customer_id for each project
        const { data: projectsData } = await supabase
          .from("projects")
          .select("id, customer_id")
          .in("id", newProjectIds);

        const projectCustomerMap = {};
        if (projectsData) {
          projectsData.forEach(p => {
            projectCustomerMap[String(p.id)] = p.customer_id;
          });
        }

        const insertData = newProjectIds.map(projectId => ({
          user_id: userId,
          project_id: projectId,
          customer_id: projectCustomerMap[String(projectId)] || null
        }));

        const { error: addError } = await supabase
          .from("user_projects")
          .insert(insertData);

        if (addError) {
          console.error("[Projects API] Error adding projects:", addError);
          return Response.json(
            { success: false, error: "Failed to add projects: " + addError.message },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
        addedCount = newProjectIds.length;
      }
    }

    return Response.json(
      {
        success: true,
        message: `Added ${addedCount} project(s), removed ${removedCount} project(s)`,
        added: addedCount,
        removed: removedCount
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] POST /api/admin/users/[userId]/projects:", error);
    return Response.json(
      { success: false, error: "Failed to update user projects" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
