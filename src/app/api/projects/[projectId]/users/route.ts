import { getTenantSupabaseClient } from "@/actions/tenantActions";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId]/users
 * Get users assigned to a project
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return Response.json(
        { error: "Project ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Project Users API] No tenant database connection");
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get users assigned to this project (with customer_id from user_projects table)
    const { data: userProjects, error: usersError } = await supabase
      .from("user_projects")
      .select("user_id, customer_id, created_at")
      .eq("project_id", projectId);

    if (usersError) {
      console.error("[Project Users API] Error fetching user projects:", usersError);
      return Response.json(
        { error: "Failed to fetch project users" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const users: Array<{
      id: string;
      first_name: string;
      last_name: string;
      company_name: string;
      added_date: string;
    }> = [];

    if (userProjects && userProjects.length > 0) {
      const userIds = userProjects.map((up) => up.user_id);

      // Create a map of user_id to customer_id from user_projects
      const userCustomerMap: Record<string, { customer_id: string; created_at: string }> = {};
      userProjects.forEach((up) => {
        userCustomerMap[String(up.user_id)] = {
          customer_id: String(up.customer_id),
          created_at: up.created_at || "",
        };
      });

      const { data: usersData } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", userIds);

      if (usersData) {
        // Get unique customer IDs from user_projects
        const customerIds = [...new Set(userProjects.map((up) => up.customer_id).filter(Boolean))];
        let customerNames: Record<string, string> = {};

        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from("customers")
            .select("id, name")
            .in("id", customerIds);

          if (customers) {
            customers.forEach((c) => {
              customerNames[String(c.id)] = c.name || "";
            });
          }
        }

        usersData.forEach((user) => {
          const userInfo = userCustomerMap[String(user.id)] || { customer_id: "", created_at: "" };
          users.push({
            id: String(user.id),
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            company_name: customerNames[userInfo.customer_id] || "",
            added_date: userInfo.created_at
              ? new Date(userInfo.created_at).toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                })
              : "",
          });
        });
      }
    }

    return Response.json(
      { success: true, users },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Project Users API] Error:", error);
    return Response.json(
      { error: "Failed to get project users" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/projects/[projectId]/users
 * Add or remove users from a project
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  try {
    const { projectId } = await context.params;
    const body = await request.json();

    if (!projectId) {
      return Response.json(
        { error: "Project ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Project Users API] No tenant database connection");
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Handle remove users
    if (body.remove && Array.isArray(body.remove) && body.remove.length > 0) {
      console.log("[Project Users API] Removing users:", body.remove);

      const { error: deleteError } = await supabase
        .from("user_projects")
        .delete()
        .eq("project_id", projectId)
        .in("user_id", body.remove);

      if (deleteError) {
        console.error("[Project Users API] Error removing users:", deleteError);
        return Response.json(
          { error: "Failed to remove users: " + deleteError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }

      return Response.json(
        { success: true, message: `Removed ${body.remove.length} user(s) from project` },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // Handle add users
    if (body.add && Array.isArray(body.add) && body.add.length > 0) {
      console.log("[Project Users API] Adding users:", body.add);

      const userProjectEntries = body.add.map((userId: string) => ({
        project_id: projectId,
        user_id: userId,
      }));

      const { error: insertError } = await supabase
        .from("user_projects")
        .upsert(userProjectEntries, { onConflict: "project_id,user_id" });

      if (insertError) {
        console.error("[Project Users API] Error adding users:", insertError);
        return Response.json(
          { error: "Failed to add users: " + insertError.message },
          { status: 500, headers: { "cache-control": "no-store" } }
        );
      }

      return Response.json(
        { success: true, message: `Added ${body.add.length} user(s) to project` },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return Response.json(
      { error: "No action specified. Use 'add' or 'remove' array." },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Project Users API] Error:", error);
    return Response.json(
      { error: "Failed to update project users" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
