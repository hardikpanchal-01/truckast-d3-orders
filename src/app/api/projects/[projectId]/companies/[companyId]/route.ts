import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET - Fetch project company details for editing
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; companyId: string }> }
) {
  try {
    const { projectId, companyId } = await params;

    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: "Database not available" }, { status: 500 });
    }

    // Get project info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, code, name, customer_id")
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[ERROR] Get project:", projectError?.message);
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Check if this is a "main_" prefixed ID (project's main customer without project_companies record)
    if (companyId.startsWith("main_")) {
      const customerId = companyId.replace("main_", "");

      // Get customer data
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, code, name")
        .eq("id", customerId)
        .single();

      if (customerError || !customer) {
        console.error("[ERROR] Get customer:", customerError?.message);
        return NextResponse.json({ error: "Customer not found" }, { status: 404 });
      }

      return NextResponse.json({
        id: companyId,
        project_id: projectId,
        project_name: project.name,
        customer_id: customer.id,
        company_name: customer.name,
        role: "general_contractor",
        notes: "",
        is_active: true,
        is_main_customer: true,
      });
    }

    // Get project company data from project_companies table
    const { data: projectCompany, error: companyError } = await supabase
      .from("project_companies")
      .select("id, project_id, customer_id, company_name, role, notes, is_active, created_at")
      .eq("id", companyId)
      .single();

    if (companyError || !projectCompany) {
      console.error("[ERROR] Get project company:", companyError?.message);
      return NextResponse.json({ error: "Company assignment not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: projectCompany.id,
      project_id: projectCompany.project_id,
      project_name: project.name,
      customer_id: projectCompany.customer_id,
      company_name: projectCompany.company_name,
      role: projectCompany.role || "general_contractor",
      notes: projectCompany.notes || "",
      is_active: projectCompany.is_active !== false,
      created_at: projectCompany.created_at,
    });
  } catch (error) {
    console.error("[ERROR] Get project company:", error);
    return NextResponse.json({ error: "Failed to get company data" }, { status: 500 });
  }
}

/**
 * POST - Update project company details
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; companyId: string }> }
) {
  try {
    const { projectId, companyId } = await params;
    const body = await request.json();

    const supabase = await getTenantSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database not available" }, { status: 500 });
    }

    const now = new Date().toISOString();

    // Check if this is a "main_" prefixed ID (project's main customer without project_companies record)
    if (companyId.startsWith("main_")) {
      const customerId = companyId.replace("main_", "");

      // Create a new project_companies record
      const insertData: Record<string, unknown> = {
        project_id: parseInt(projectId, 10),
        customer_id: parseInt(customerId, 10),
        company_name: body.company_name || "",
        role: body.role || "general_contractor",
        role_type: (body.role || "general_contractor").toUpperCase().replace(/_/g, " "),
        notes: body.notes || "",
        is_active: body.is_active !== false,
        created_at: now,
        updated_at: now,
      };

      const { error: insertError } = await supabase
        .from("project_companies")
        .insert(insertData);

      if (insertError) {
        console.error("[ERROR] Insert project company:", insertError.message);
        return NextResponse.json({ success: false, error: "Failed to save: " + insertError.message }, { status: 500 });
      }

      console.log(`[PROJECT COMPANY] Created company record for customer ${customerId} in project ${projectId}`);
      return NextResponse.json({ success: true });
    }

    // Update existing project company
    const updateData: Record<string, unknown> = {
      updated_at: now,
    };

    if (body.company_name !== undefined) {
      updateData.company_name = body.company_name;
    }
    if (body.role !== undefined) {
      updateData.role = body.role;
      updateData.role_type = body.role.toUpperCase().replace(/_/g, " ");
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }
    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    const { error: updateError } = await supabase
      .from("project_companies")
      .update(updateData)
      .eq("id", companyId)
      .eq("project_id", projectId);

    if (updateError) {
      console.error("[ERROR] Update project company:", updateError.message);
      return NextResponse.json({ success: false, error: "Failed to update: " + updateError.message }, { status: 500 });
    }

    console.log(`[PROJECT COMPANY] Updated company ${companyId} for project ${projectId}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[ERROR] Update project company:", error);
    return NextResponse.json({ success: false, error: "Failed to update company" }, { status: 500 });
  }
}
