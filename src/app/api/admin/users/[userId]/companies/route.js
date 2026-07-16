import { getTenantSupabaseClient } from "@/actions/tenantActions";
import supabaseServer from "@/supabase/server";

export const dynamic = "force-dynamic";

// Helper to get supabase client with fallback
async function getSupabaseClient() {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

/**
 * GET /api/admin/users/[userId]/companies
 * Get user's assigned customers/companies
 */
export async function GET(request, { params }) {
  console.log("========== [USER COMPANIES API] START ==========");
  try {
    const { userId } = await params;
    console.log("[USER COMPANIES] User ID from params:", userId);

    if (!userId) {
      console.log("[USER COMPANIES] ERROR: No userId provided");
      return Response.json(
        { success: false, error: "User ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[USER COMPANIES] Getting supabase client...");
    const supabase = await getSupabaseClient();
    console.log("[USER COMPANIES] Supabase client:", supabase ? "OK" : "NULL");

    if (!supabase) {
      console.error("[USER COMPANIES] No database connection available");
      return Response.json(
        { success: true, companies: [], warning: "No database connection" },
        { headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[USER COMPANIES] Getting companies for user:", userId);

    // Get user's customers from user_customers table
    console.log("[USER COMPANIES] Querying user_customers table...");
    const { data: userCustomers, error: customersError } = await supabase
      .from("user_customers")
      .select("customer_id")
      .eq("user_id", userId);

    console.log("[USER COMPANIES] Query result:", {
      userCustomersCount: userCustomers?.length || 0,
      userCustomers: userCustomers,
      error: customersError?.message || null,
      errorCode: customersError?.code || null
    });

    if (customersError) {
      console.error("[USER COMPANIES] Error fetching user customers:", customersError);
      return Response.json(
        { success: true, companies: [], error: customersError.message },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // Get customer details
    const customerIds = (userCustomers || []).map(uc => uc.customer_id);
    console.log("[USER COMPANIES] Customer IDs:", customerIds);

    let companies = [];

    if (customerIds.length > 0) {
      console.log("[USER COMPANIES] Querying customers table for IDs:", customerIds);
      const { data: customers, error: detailsError } = await supabase
        .from("customers")
        .select("id, code, name")
        .in("id", customerIds);

      console.log("[USER COMPANIES] Customers query result:", {
        customersCount: customers?.length || 0,
        error: detailsError?.message || null
      });

      if (!detailsError && customers) {
        companies = customers.map(c => ({
          id: String(c.id),
          code: c.code || "",
          name: c.name || "Unknown"
        }));
      }
    }

    console.log("[USER COMPANIES] Final companies:", companies);
    console.log("========== [USER COMPANIES API] END ==========");

    return Response.json(
      { success: true, companies },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("========== [USER COMPANIES API] ERROR ==========");
    console.error("[ERROR] GET /api/admin/users/[userId]/companies:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    return Response.json(
      { success: false, error: "Failed to get user companies: " + error.message },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/companies
 * Add or remove customer access for a user
 */
export async function POST(request, { params }) {
  try {
    const { userId } = await params;

    if (!userId) {
      return Response.json(
        { success: false, error: "User ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const body = await request.json();
    const { add, remove } = body;

    const supabase = await getSupabaseClient();

    if (!supabase) {
      console.error("[USER COMPANIES] No database connection available");
      return Response.json(
        { success: false, error: "No database connection" },
        { status: 500, headers: { "cache-control": "no-store" } }
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

    // Remove customer access
    if (remove && Array.isArray(remove) && remove.length > 0) {
      console.log("[USER COMPANIES] Removing access for customers:", remove);

      const { error: removeError } = await supabase
        .from("user_customers")
        .delete()
        .eq("user_id", userId)
        .in("customer_id", remove);

      if (removeError) {
        console.error("[USER COMPANIES] Error removing access:", removeError.message);
      }
    }

    // Add customer access
    if (add && Array.isArray(add) && add.length > 0) {
      console.log("[USER COMPANIES] Adding access for customers:", add);

      // Check which customers are already assigned
      const { data: existing } = await supabase
        .from("user_customers")
        .select("customer_id")
        .eq("user_id", userId)
        .in("customer_id", add);

      const existingIds = (existing || []).map(e => String(e.customer_id));
      const newCustomers = add.filter(id => !existingIds.includes(String(id)));

      if (newCustomers.length > 0) {
        const insertData = newCustomers.map(customerId => ({
          user_id: userId,
          customer_id: customerId
        }));

        const { error: addError } = await supabase
          .from("user_customers")
          .insert(insertData);

        if (addError) {
          console.error("[USER COMPANIES] Error adding access:", addError.message);
          return Response.json(
            { success: false, error: "Failed to add customer access: " + addError.message },
            { status: 500, headers: { "cache-control": "no-store" } }
          );
        }
      }
    }

    return Response.json(
      { success: true, message: "Customer access updated successfully" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] POST /api/admin/users/[userId]/companies:", error);
    return Response.json(
      { success: false, error: "Failed to update customer access" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
