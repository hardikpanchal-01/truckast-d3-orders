import { getTenantSupabaseClient } from "@/actions/tenantActions";
import supabaseServer from "@/supabase/server";

export const dynamic = "force-dynamic";

// Helper to get supabase client with fallback
async function getSupabaseClient() {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

/**
 * GET /api/admin/users/[userId]/projects
 * Get all projects the user has access to from user_projects table
 */
export async function GET(request, { params }) {
  console.log("========== [USER PROJECTS API] GET START ==========");
  const { userId } = await params;
  console.log("[USER PROJECTS] User ID from params:", userId);

  if (!userId) {
    console.log("[USER PROJECTS] ERROR: No userId provided");
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    console.log("[USER PROJECTS] Getting supabase client...");
    const supabase = await getSupabaseClient();
    console.log("[USER PROJECTS] Supabase client:", supabase ? "OK" : "NULL");

    if (!supabase) {
      console.error("[USER PROJECTS] No database connection available");
      return Response.json(
        { success: true, projects: [], warning: "No database connection" },
        { headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[USER PROJECTS] Querying user_projects table for user:", userId);

    // Step 1: Get user's project assignments
    const { data: userProjects, error: projectsError } = await supabase
      .from("user_projects")
      .select("project_id, customer_id")
      .eq("user_id", userId);

    console.log("[USER PROJECTS] user_projects query result:", {
      userProjectsCount: userProjects?.length || 0,
      error: projectsError?.message || null
    });

    if (projectsError) {
      console.error("[USER PROJECTS] Error fetching user_projects:", projectsError);
      return Response.json(
        { success: true, projects: [], error: projectsError.message },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // If no projects assigned, return empty array
    if (!userProjects || userProjects.length === 0) {
      console.log("[USER PROJECTS] No projects assigned to user");
      return Response.json(
        { success: true, projects: [] },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // Step 2: Get project details
    const projectIds = userProjects.map(up => up.project_id);
    console.log("[USER PROJECTS] Fetching project details for IDs:", projectIds);

    const { data: projectsData, error: projectsDetailError } = await supabase
      .from("projects")
      .select("id, code, name, customer_id")
      .in("id", projectIds);

    console.log("[USER PROJECTS] projects query result:", {
      projectsCount: projectsData?.length || 0,
      error: projectsDetailError?.message || null
    });

    if (projectsDetailError) {
      console.error("[USER PROJECTS] Error fetching projects:", projectsDetailError);
    }

    // Step 3: Get customer details
    const customerIds = [...new Set((projectsData || []).map(p => p.customer_id).filter(Boolean))];
    let customerMap = {};

    if (customerIds.length > 0) {
      console.log("[USER PROJECTS] Fetching customer details for IDs:", customerIds);

      const { data: customersData, error: customersError } = await supabase
        .from("customers")
        .select("id, code, name")
        .in("id", customerIds);

      console.log("[USER PROJECTS] customers query result:", {
        customersCount: customersData?.length || 0,
        error: customersError?.message || null
      });

      if (customersData) {
        customersData.forEach(c => {
          customerMap[String(c.id)] = c;
        });
      }
    }

    // Step 4: Build final projects array
    const projects = (projectsData || []).map(p => {
      const customer = customerMap[String(p.customer_id)] || {};
      return {
        id: String(p.id),
        code: p.code || "",
        name: p.name || "",
        customer_id: p.customer_id ? String(p.customer_id) : "",
        customer_code: customer.code || "",
        customer_name: customer.name || ""
      };
    });

    console.log("[USER PROJECTS] Final projects:", projects);
    console.log("========== [USER PROJECTS API] GET END ==========");

    return Response.json(
      { success: true, projects },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("========== [USER PROJECTS API] GET ERROR ==========");
    console.error("[ERROR] GET /api/admin/users/[userId]/projects:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return Response.json(
      { success: false, error: "Failed to get user projects: " + error.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/projects
 * Add or remove projects from user
 * Body: { add: [projectId, ...], remove: [projectId, ...], removeAll: boolean }
 */
export async function POST(request, { params }) {
  console.log("========== [USER PROJECTS API] POST START ==========");
  const { userId } = await params;
  console.log("[USER PROJECTS POST] User ID:", userId);

  if (!userId) {
    console.log("[USER PROJECTS POST] ERROR: No userId provided");
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const body = await request.json();
    const { add = [], remove = [], removeAll = false } = body;
    console.log("[USER PROJECTS POST] Request body:", { add, remove, removeAll });

    console.log("[USER PROJECTS POST] Getting supabase client...");
    const supabase = await getSupabaseClient();
    console.log("[USER PROJECTS POST] Supabase client:", supabase ? "OK" : "NULL");

    if (!supabase) {
      console.error("[USER PROJECTS POST] No database connection available");
      return Response.json(
        { success: false, error: "No database connection" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    let addedCount = 0;
    let removedCount = 0;

    // Remove ALL projects
    if (removeAll) {
      console.log("[USER PROJECTS POST] Removing ALL projects for user:", userId);

      // First count existing projects
      const { data: existingProjects } = await supabase
        .from("user_projects")
        .select("id")
        .eq("user_id", userId);

      const existingCount = existingProjects?.length || 0;
      console.log("[USER PROJECTS POST] Found", existingCount, "existing projects to remove");

      const { error: removeAllError } = await supabase
        .from("user_projects")
        .delete()
        .eq("user_id", userId);

      if (removeAllError) {
        console.error("[USER PROJECTS POST] Error removing all projects:", removeAllError);
        return Response.json(
          { success: false, error: "Failed to remove all projects: " + removeAllError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }

      removedCount = existingCount;
      console.log("[USER PROJECTS POST] All projects removed successfully");
    }

    // Remove specific projects
    if (remove.length > 0) {
      console.log("[USER PROJECTS POST] Removing specific projects:", remove);

      const { error: removeError } = await supabase
        .from("user_projects")
        .delete()
        .eq("user_id", userId)
        .in("project_id", remove);

      if (removeError) {
        console.error("[USER PROJECTS POST] Error removing projects:", removeError);
        return Response.json(
          { success: false, error: "Failed to remove projects: " + removeError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }
      removedCount = remove.length;
      console.log("[USER PROJECTS POST] Removed", removedCount, "projects");
    }

    // Add projects
    if (add.length > 0) {
      console.log("[USER PROJECTS POST] Adding projects:", add);

      // Extract project IDs (handle both array of IDs and array of objects)
      const projectIds = add.map(item => typeof item === 'object' ? item.project_id : item);
      console.log("[USER PROJECTS POST] Project IDs to add:", projectIds);

      // First check which projects user already has access to
      const { data: existingAccess } = await supabase
        .from("user_projects")
        .select("project_id")
        .eq("user_id", userId)
        .in("project_id", projectIds);

      const existingProjectIds = new Set((existingAccess || []).map(e => String(e.project_id)));
      console.log("[USER PROJECTS POST] Existing project IDs:", Array.from(existingProjectIds));

      // Only add projects that don't already exist
      const newItems = add.filter(item => {
        const pid = typeof item === 'object' ? item.project_id : item;
        return !existingProjectIds.has(String(pid));
      });

      console.log("[USER PROJECTS POST] New items to add:", newItems.length);

      if (newItems.length > 0) {
        // Get customer_id for each project if not provided
        const newProjectIds = newItems.map(item => typeof item === 'object' ? item.project_id : item);
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

        const insertData = newItems.map(item => {
          const projectId = typeof item === 'object' ? item.project_id : item;
          const customerId = typeof item === 'object' && item.customer_id
            ? item.customer_id
            : projectCustomerMap[String(projectId)] || null;
          return {
            user_id: userId,
            project_id: projectId,
            customer_id: customerId
          };
        });

        console.log("[USER PROJECTS POST] Insert data:", insertData);

        const { error: addError } = await supabase
          .from("user_projects")
          .insert(insertData);

        if (addError) {
          console.error("[USER PROJECTS POST] Error adding projects:", addError);
          return Response.json(
            { success: false, error: "Failed to add projects: " + addError.message },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
        addedCount = newItems.length;
        console.log("[USER PROJECTS POST] Added", addedCount, "projects");
      }
    }

    console.log("[USER PROJECTS POST] Final result - Added:", addedCount, "Removed:", removedCount);
    console.log("========== [USER PROJECTS API] POST END ==========");

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
    console.error("========== [USER PROJECTS API] POST ERROR ==========");
    console.error("[ERROR] POST /api/admin/users/[userId]/projects:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return Response.json(
      { success: false, error: "Failed to update user projects: " + error.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
