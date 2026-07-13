export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for getting user's assigned companies.
 */
export async function GET(request, { params }) {
  try {
    const { userId } = await params;

    if (!userId) {
      return Response.json(
        { success: false, error: "User ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[USER COMPANIES] Supabase credentials not configured");
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log("[USER COMPANIES] Getting companies for user:", userId);

    // Try to get user's companies from user_companies table
    const { data: userCompanies, error: companiesError } = await supabaseAdmin
      .from("user_companies")
      .select(`
        company_id,
        companies (
          id,
          name
        )
      `)
      .eq("user_id", userId);

    if (companiesError) {
      console.warn("[USER COMPANIES] Error fetching user companies:", companiesError.message);
      // Return empty list if table doesn't exist
      return Response.json(
        { success: true, data: [] },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // Format the response
    const companies = (userCompanies || []).map((uc) => ({
      id: uc.company_id,
      name: uc.companies?.name || "Unknown",
      has_access: true,
    }));

    console.log("[USER COMPANIES] Found", companies.length, "companies");

    return Response.json(
      { success: true, data: companies },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/[userId]/companies:", error);
    return Response.json(
      { success: false, error: "Failed to get user companies" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
