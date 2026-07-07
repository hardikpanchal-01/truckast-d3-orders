import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

// Helper to get tenant client
async function getTenantClient() {
  let selectedTenant = await getSelectedTenant();
  if (!selectedTenant) {
    selectedTenant = "Dolese Ready Mix";
  }

  const tenantCreds = await getTenantCredentials(selectedTenant);
  if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
    return null;
  }

  return createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

/**
 * GET /api/announcements/[id]
 * Get single announcement by ID
 */
export async function GET(request, { params }) {
  try {
    const tenantClient = await getTenantClient();
    if (!tenantClient) {
      return NextResponse.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500 }
      );
    }

    const { id } = await params;

    const { data: announcement, error } = await tenantClient
      .from("announcements")
      .select(`
        *,
        announcement_organizations (zone_name),
        announcement_screens (plant_code)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching announcement:", error);
      return NextResponse.json(
        { success: false, error: "Announcement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: announcement });
  } catch (error) {
    console.error("Error in GET /api/announcements/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/announcements/[id]
 * Update announcement
 */
export async function PUT(request, { params }) {
  try {
    console.log("[PUT Announcement] Starting update...");

    const tenantClient = await getTenantClient();
    if (!tenantClient) {
      console.log("[PUT Announcement] ERROR: Could not connect to tenant database");
      return NextResponse.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500 }
      );
    }
    console.log("[PUT Announcement] Connected to tenant database");

    const { id } = await params;
    console.log("[PUT Announcement] Updating ID:", id);

    const body = await request.json();
    console.log("[PUT Announcement] Request body:", JSON.stringify(body, null, 2));

    const {
      name,
      campaign_id,
      start_date,
      end_date,
      tile_type,
      tagline,
      title,
      subtitle,
      icon_or_percent,
      color,
      is_published,
      message_details,
      organizations,
      screens
    } = body;

    // Update announcement
    const { data: announcement, error: updateError } = await tenantClient
      .from("announcements")
      .update({
        name,
        campaign_id: campaign_id || null,
        start_date,
        end_date,
        tile_type: tile_type || "3x1Icon",
        tagline,
        title,
        subtitle,
        icon_or_percent,
        color,
        is_published: is_published || false,
        message_details
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[PUT Announcement] ERROR updating:", updateError);
      return NextResponse.json(
        { success: false, error: updateError.message },
        { status: 400 }
      );
    }
    console.log("[PUT Announcement] Announcement updated successfully:", announcement.id);

    // Delete existing associations
    console.log("[PUT Announcement] Deleting existing associations...");
    const { error: delOrgError } = await tenantClient
      .from("announcement_organizations")
      .delete()
      .eq("announcement_id", id);
    if (delOrgError) console.log("[PUT Announcement] Error deleting orgs:", delOrgError);

    const { error: delScreenError } = await tenantClient
      .from("announcement_screens")
      .delete()
      .eq("announcement_id", id);
    if (delScreenError) console.log("[PUT Announcement] Error deleting screens:", delScreenError);

    // Insert new organization/zone associations
    console.log("[PUT Announcement] Organizations to insert:", organizations);
    if (organizations && organizations.length > 0) {
      const orgInserts = organizations.map(zone => ({
        announcement_id: id,
        zone_name: zone
      }));
      console.log("[PUT Announcement] Inserting orgs:", orgInserts);

      const { error: insertOrgError } = await tenantClient
        .from("announcement_organizations")
        .insert(orgInserts);
      if (insertOrgError) console.log("[PUT Announcement] Error inserting orgs:", insertOrgError);
    }

    // Insert new screen/plant associations
    console.log("[PUT Announcement] Screens to insert:", screens);
    if (screens && screens.length > 0) {
      const screenInserts = screens.map(plant => ({
        announcement_id: id,
        plant_code: plant
      }));
      console.log("[PUT Announcement] Inserting screens:", screenInserts);

      const { error: insertScreenError } = await tenantClient
        .from("announcement_screens")
        .insert(screenInserts);
      if (insertScreenError) console.log("[PUT Announcement] Error inserting screens:", insertScreenError);
    }

    console.log("[PUT Announcement] Update complete!");
    return NextResponse.json({
      success: true,
      data: announcement,
      message: "Announcement updated successfully"
    });
  } catch (error) {
    console.error("Error in PUT /api/announcements/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/announcements/[id]
 * Delete announcement
 */
export async function DELETE(request, { params }) {
  try {
    const tenantClient = await getTenantClient();
    if (!tenantClient) {
      return NextResponse.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500 }
      );
    }

    const { id } = await params;

    const { error } = await tenantClient
      .from("announcements")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting announcement:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Announcement deleted successfully"
    });
  } catch (error) {
    console.error("Error in DELETE /api/announcements/[id]:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
