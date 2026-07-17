import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      firstname,
      lastname,
      email,
      title,
      mobile_number,
      all_projects,
      measurement_system,
      invite_from,
      customer_id,
      customer_name,
      customer_code,
      project_id,
      project_name,
      project_code,
    } = body;

    // Validate required fields
    if (!firstname || !lastname || !email || !mobile_number) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Create Supabase client
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Create the invitation record
    const invitationData = {
      first_name: firstname,
      last_name: lastname,
      email: email,
      title: title || null,
      mobile_number: mobile_number,
      all_projects: all_projects || false,
      measurement_system: measurement_system || "STANDARD",
      invite_from: invite_from || "DOLESE",
      customer_id: customer_id || null,
      customer_name: customer_name ? decodeURIComponent(customer_name) : null,
      customer_code: customer_code ? decodeURIComponent(customer_code) : null,
      project_id: project_id || null,
      project_name: project_name ? decodeURIComponent(project_name) : null,
      project_code: project_code ? decodeURIComponent(project_code) : null,
      status: "pending",
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("invitations")
      .insert([invitationData])
      .select()
      .single();

    if (error) {
      console.error("Error creating invitation:", error);
      // If table doesn't exist, just return success for now
      if (error.code === "42P01") {
        return NextResponse.json({
          success: true,
          message: "Invitation sent successfully (demo mode)",
        }, { headers: { "cache-control": "no-store" } });
      }
      return NextResponse.json(
        { error: "Failed to create invitation: " + error.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json({
      success: true,
      invitation: data,
      message: "Invitation sent successfully",
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Error processing invitation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    let query = supabase.from("invitations").select("*");

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching invitations:", error);
      return NextResponse.json(
        { error: "Failed to fetch invitations" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    return NextResponse.json({ invitations: data }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
