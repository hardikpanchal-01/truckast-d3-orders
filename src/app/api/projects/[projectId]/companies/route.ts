import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * POST - Add a company to a project
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();

    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    // Validate required fields
    if (!body.customer_id) {
      return NextResponse.json({ success: false, error: "Customer ID is required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Check if company is already linked to this project
    const { data: existing } = await supabase
      .from("project_companies")
      .select("id")
      .eq("project_id", projectId)
      .eq("customer_id", body.customer_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: false, error: "Company is already linked to this project" }, { status: 400 });
    }

    // Insert the new project company record
    const insertData: Record<string, unknown> = {
      project_id: parseInt(projectId, 10),
      customer_id: parseInt(body.customer_id, 10),
      company_name: body.company_name || "",
      role: body.role || "general_contractor",
      role_type: (body.role || "general_contractor").toUpperCase().replace(/_/g, " "),
      notes: body.notes || "",
      is_active: body.is_active !== false,
      created_at: now,
      updated_at: now,
    };

    const { data: newCompany, error: insertError } = await supabase
      .from("project_companies")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError) {
      console.error("[ERROR] Insert project company:", insertError.message);
      return NextResponse.json({ success: false, error: "Failed to add company: " + insertError.message }, { status: 500 });
    }

    console.log(`[PROJECT COMPANY] Added company ${body.customer_id} to project ${projectId}`);

    return NextResponse.json({
      success: true,
      id: newCompany?.id
    });
  } catch (error) {
    console.error("[ERROR] Add company to project:", error);
    return NextResponse.json({ success: false, error: "Failed to add company to project" }, { status: 500 });
  }
}

/**
 * GET - List companies for a project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get project companies
    const { data: projectCompanies, error } = await supabase
      .from("project_companies")
      .select(`
        id,
        customer_id,
        company_name,
        role,
        role_type,
        notes,
        is_active,
        created_at,
        customers (
          id,
          code,
          name
        )
      `)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[ERROR] Get project companies:", error.message);
      return NextResponse.json({ error: "Failed to get companies" }, { status: 500 });
    }

    const companies = (projectCompanies || []).map(pc => {
      // Handle customers relation - could be array or single object
      const customer = Array.isArray(pc.customers) ? pc.customers[0] : pc.customers;
      return {
        id: pc.id,
        customer_id: pc.customer_id,
        code: customer?.code || "",
        name: pc.company_name || customer?.name || "",
        role: pc.role,
        role_type: pc.role_type,
        notes: pc.notes,
        is_active: pc.is_active,
        created_at: pc.created_at,
      };
    });

    return NextResponse.json({ success: true, companies });
  } catch (error) {
    console.error("[ERROR] Get project companies:", error);
    return NextResponse.json({ error: "Failed to get companies" }, { status: 500 });
  }
}
