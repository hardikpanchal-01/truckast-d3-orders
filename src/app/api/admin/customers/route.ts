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
      .select("id, code, name, address1, address2, address3")
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
      // Parse address3 for state (format: "STATE ZIPCODE")
      let state = "";
      if (c.address3) {
        const parts = c.address3.trim().split(/\s+/);
        if (parts.length >= 1 && !/^\d/.test(parts[0])) {
          state = parts[0];
        }
      }

      return {
        id: c.id,
        code: c.code || "",
        name: c.name || "",
        address: c.address1 || "",
        city: c.address2 || "",
        state: state,
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
