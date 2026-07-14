import { getTenantSupabaseClient } from "@/actions/tenantActions";
import supabaseServer from "@/supabase/server";

export const dynamic = "force-dynamic";

// Helper to get the appropriate Supabase client (tenant-specific or default)
async function getSupabaseClient() {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

/**
 * GET /api/customers/[id]
 * Get customer details with projects and users
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    console.log("[Customer Details API] Getting customer:", id);

    const supabase = await getSupabaseClient();

    if (!supabase) {
      console.error("[Customer Details API] No database connection");
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get customer basic info
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (customerError || !customer) {
      console.error("[Customer Details API] Customer not found:", customerError);
      return Response.json(
        { error: "Customer not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get users linked to this customer
    const { data: userLinks, error: userLinksError } = await supabase
      .from("user_customers")
      .select("user_id")
      .eq("customer_id", id);

    console.log("[Customer Details API] User links:", userLinks?.length, "Error:", userLinksError);

    const userIds = (userLinks || []).map((link) => link.user_id);
    const totalUsers = userIds.length;

    // Get user details using same columns as adminActions
    let users: { id: string; full_name: string; email: string; last_activity: string | null }[] = [];
    if (userIds.length > 0) {
      console.log("[Customer Details API] Fetching users for IDs:", JSON.stringify(userIds));

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email, last_login_at")
        .in("id", userIds);

      console.log("[Customer Details API] Users query result:", {
        found: usersData?.length || 0,
        error: usersError?.message || null,
        firstUser: usersData?.[0] || null
      });

      if (usersError) {
        console.error("[Customer Details API] Users error:", usersError);
      }

      users = (usersData || []).map((u) => ({
        id: u.id,
        full_name: u.full_name || "",
        email: u.email || "",
        last_activity: u.last_login_at || null,
      }));

      // Sort by full_name
      users.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
    }

    // Get projects for this customer
    const { data: projectsData } = await supabase
      .from("projects")
      .select("id, code, name")
      .eq("customer_id", id)
      .order("name", { ascending: true });

    // Get user counts per project
    const projectIds = (projectsData || []).map((p) => p.id);
    const projectUserCountMap = new Map<string, number>();

    if (projectIds.length > 0) {
      const { data: projectUserLinks } = await supabase
        .from("user_projects")
        .select("project_id")
        .in("project_id", projectIds);

      for (const link of projectUserLinks || []) {
        if (link.project_id != null) {
          const projId = String(link.project_id);
          projectUserCountMap.set(projId, (projectUserCountMap.get(projId) || 0) + 1);
        }
      }
    }

    const projects = (projectsData || []).map((p) => ({
      id: String(p.id),
      code: p.code || "",
      name: p.name || "",
      user_count: projectUserCountMap.get(String(p.id)) || 0,
    }));

    // Get project users (users assigned to projects of this customer)
    let projectUsers: {
      user_id: string;
      full_name: string;
      email: string;
      project_id: string;
      project_name: string;
      project_code: string;
      last_activity: string | null;
    }[] = [];

    if (projectIds.length > 0) {
      const { data: projectUserLinks } = await supabase
        .from("user_projects")
        .select("user_id, project_id")
        .in("project_id", projectIds);

      if (projectUserLinks && projectUserLinks.length > 0) {
        const projUserIds = [...new Set(projectUserLinks.map((l) => l.user_id))];

        const { data: projUsersData } = await supabase
          .from("users")
          .select("id, full_name, email, last_login_at")
          .in("id", projUserIds);

        const userMap = new Map(
          (projUsersData || []).map((u) => [u.id, u])
        );
        const projectMap = new Map(
          (projectsData || []).map((p) => [p.id, p])
        );

        for (const link of projectUserLinks) {
          const user = userMap.get(link.user_id);
          const project = projectMap.get(link.project_id);
          if (user && project) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const u = user as any;
            projectUsers.push({
              user_id: u.id,
              full_name: u.full_name || "",
              email: u.email || "",
              project_id: String(project.id),
              project_name: project.name || "",
              project_code: project.code || "",
              last_activity: u.last_login_at || null,
            });
          }
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cust = customer as any;
    const response = {
      customer: {
        id: String(cust.id),
        code: cust.code || "",
        name: cust.name || "",
        region: cust.region || cust.business_unit || "",
        home_builder: cust.home_builder || cust.homebuilder || false,
        main_color: cust.main_color || cust.primary_color || "",
        secondary_color: cust.secondary_color || "",
        status: cust.inactive ? "inactive" : "active",
      },
      total_users: totalUsers,
      users,
      projects,
      project_users: projectUsers,
    };

    return Response.json(response, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[Customer Details API] Error:", error);
    return Response.json(
      { error: "Failed to get customer details" },
      { status: 500 }
    );
  }
}
