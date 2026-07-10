import { NextResponse } from "next/server";
import supabaseServer from "@/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/campaigns
 * Returns all campaigns
 */
export async function GET() {
  try {
    const { data: campaigns, error } = await supabaseServer
      .from("campaigns")
      .select("id, name, description")
      .order("name");

    if (error) {
      console.error("Error fetching campaigns:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaigns || []
    });
  } catch (error) {
    console.error("Error in GET /api/campaigns:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/campaigns
 * Create a new campaign
 */
export async function POST(request) {
  try {
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
      .insert({
        name: name,
        description: description || ""
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating campaign:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: campaign,
      message: "Campaign created successfully"
    });
  } catch (error) {
    console.error("Error in POST /api/campaigns:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
