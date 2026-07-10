import { NextResponse } from "next/server";
import supabaseServer from "@/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns/[id]
 * Get single campaign by ID
 */
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    const { data: campaign, error } = await supabaseServer
      .from("campaigns")
      .select("id, name, description")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching campaign:", error);
      return NextResponse.json(
        { success: false, error: "Campaign not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error("Error in GET /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/campaigns/[id]
 * Update campaign
 */
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Campaign name is required" },
        { status: 400 }
      );
    }

    const { data: campaign, error } = await supabaseServer
      .from("campaigns")
      .update({
        name: name,
        description: description || ""
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      message: "Campaign updated successfully"
    });
  } catch (error) {
    console.error("Error in PUT /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/campaigns/[id]
 * Delete campaign
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    const { error } = await supabaseServer
      .from("campaigns")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Campaign deleted successfully"
    });
  } catch (error) {
    console.error("Error in DELETE /api/campaigns/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
