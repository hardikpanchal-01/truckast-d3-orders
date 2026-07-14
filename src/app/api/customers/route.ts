import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/customers?search=...
 * Search customers by name or code via AJAX
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const searchText = searchParams.get("search") || "";

    console.log("[Customers API] Searching for:", searchText);

    // If search text is empty, return empty results
    if (!searchText || searchText.trim().length === 0) {
      return Response.json({ customers: [], total: 0 }, {
        headers: { "cache-control": "no-store" },
      });
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Customers API] No tenant database connection");
      return Response.json(
        { error: "No tenant selected", customers: [], total: 0 },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const searchTerm = searchText.trim();
    console.log("[Customers API] Searching with term:", searchTerm);

    // Search in customers table
    const { data, error } = await supabase
      .from("customers")
      .select("id, code, name, inactive, contact, phone, email, salesman_name")
      .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`)
      .order("name", { ascending: true })
      .limit(50);

    if (error) {
      console.error("[Customers API] Search error:", error);
      return Response.json(
        { error: error.message, customers: [], total: 0 },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[Customers API] Found", data?.length || 0, "customers");

    // Get user counts from user_customers table
    const customerIds = (data || []).map((c) => c.id);
    const userCountMap = new Map<string, number>();

    if (customerIds.length > 0) {
      const { data: userLinks } = await supabase
        .from("user_customers")
        .select("customer_id")
        .in("customer_id", customerIds);

      for (const link of userLinks || []) {
        if (link.customer_id != null) {
          const custId = String(link.customer_id);
          userCountMap.set(custId, (userCountMap.get(custId) || 0) + 1);
        }
      }
    }

    const customers = (data || []).map((row) => ({
      id: String(row.id),
      code: row.code || "",
      name: row.name || "",
      status: row.inactive ? "inactive" : "active",
      user_count: userCountMap.get(String(row.id)) || 0,
      contact: row.contact || undefined,
      phone: row.phone || undefined,
      email: row.email || undefined,
      salesman_name: row.salesman_name || undefined,
    }));

    return Response.json({ customers, total: customers.length }, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.error("[Customers API] Error:", error);
    return Response.json(
      { error: "Failed to search customers", customers: [], total: 0 },
      { status: 500 }
    );
  }
}
