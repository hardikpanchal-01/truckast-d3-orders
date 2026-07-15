import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[userId]/add-projects/search?q=...
 * Search for companies/customers with their project counts
 */
export async function GET(request, { params }) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const searchText = searchParams.get("q") || "";

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  if (!searchText || searchText.trim().length === 0) {
    return Response.json(
      { success: true, companies: [] },
      { headers: { "cache-control": "no-store" } }
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

    const searchTerm = searchText.trim();

    // Search for customers
    const { data: customers, error: customersError } = await supabase
      .from("customers")
      .select("id, code, name")
      .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
      .order("name", { ascending: true })
      .limit(50);

    if (customersError) {
      console.error("[Add Projects API] Search error:", customersError);
      return Response.json(
        { success: false, error: customersError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // Get project counts for each customer
    const customerIds = (customers || []).map(c => c.id);
    const projectCountMap = new Map();

    if (customerIds.length > 0) {
      // Try to get project counts from projects table
      try {
        const { data: projects } = await supabase
          .from("projects")
          .select("customer_id")
          .in("customer_id", customerIds);

        for (const project of projects || []) {
          if (project.customer_id) {
            const custId = String(project.customer_id);
            projectCountMap.set(custId, (projectCountMap.get(custId) || 0) + 1);
          }
        }
      } catch (e) {
        console.log("[Add Projects API] Could not get project counts:", e.message);
      }
    }

    const companies = (customers || []).map(row => ({
      id: String(row.id),
      code: row.code || "",
      name: row.name || "",
      project_count: projectCountMap.get(String(row.id)) || 0
    }));

    return Response.json(
      { success: true, companies },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/users/[userId]/add-projects/search:", error);
    return Response.json(
      { success: false, error: "Failed to search companies" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
