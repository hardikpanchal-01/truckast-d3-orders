import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET - Search customers by name or code
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";

    // Get tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return NextResponse.json(
        { success: false, error: "Database not available" },
        { status: 500 }
      );
    }

    const supabase = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Search customers
    let customersQuery = supabase
      .from("customers")
      .select("id, code, name, contact, phone, email")
      .order("name", { ascending: true })
      .limit(100);

    if (query && query.trim().length > 0) {
      const searchTerm = query.trim();
      // Search by name or code (case insensitive)
      customersQuery = customersQuery.or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);
    }

    const { data: customers, error } = await customersQuery;

    if (error) {
      console.error("[ERROR] Search customers:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    // Format the results
    const results = (customers || []).map((c) => {
      return {
        id: c.id,
        code: c.code || "",
        name: c.name || "",
        contact: c.contact || "",
        phone: c.phone || "",
        email: c.email || "",
      };
    });

    console.log(`[CUSTOMERS] Search "${query}" found ${results.length} results`);

    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error("[ERROR] /api/admin/customers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search customers" },
      { status: 500 }
    );
  }
}
