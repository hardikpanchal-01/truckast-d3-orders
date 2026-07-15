import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[userId]/customer-projects?customerId=...
 * Get projects for a specific customer and which ones the user already has access to
 */
export async function GET(request, { params }) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!customerId) {
    return Response.json(
      { success: false, error: "Customer ID is required" },
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

    // Get customer info
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, code, name")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError || !customer) {
      return Response.json(
        { success: false, error: "Customer not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get all projects for this customer
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, code, name")
      .eq("customer_id", customerId)
      .order("name", { ascending: true });

    if (projectsError) {
      console.error("[Customer Projects API] Error fetching projects:", projectsError);
    }

    // Get user's existing project access
    let userProjects = [];
    try {
      const { data: userProjectLinks } = await supabase
        .from("user_projects")
        .select("project_id")
        .eq("user_id", userId);

      if (userProjectLinks) {
        const userProjectIds = userProjectLinks.map(up => up.project_id);

        // Filter to only projects from this customer that user has access to
        const projectIds = (projects || []).map(p => p.id);
        userProjects = (projects || []).filter(p => userProjectIds.includes(p.id));
      }
    } catch (e) {
      console.log("[Customer Projects API] Could not get user projects:", e.message);
    }

    return Response.json(
      {
        success: true,
        customer: {
          id: customer.id,
          code: customer.code,
          name: customer.name
        },
        projects: (projects || []).map(p => ({
          id: String(p.id),
          code: p.code || "",
          name: p.name || "",
          customer_name: customer.name || "",
          customer_code: customer.code || ""
        })),
        userProjects: userProjects.map(p => ({
          id: String(p.id),
          code: p.code || "",
          name: p.name || "",
          customer_name: customer.name || "",
          customer_code: customer.code || ""
        }))
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/users/[userId]/customer-projects:", error);
    return Response.json(
      { success: false, error: "Failed to get customer projects" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
