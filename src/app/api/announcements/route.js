import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import supabaseServer from "@/supabase/server";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/announcements
 * Returns all form data (campaigns, organizations/regions, screens/plants, announcements)
 */
export async function GET() {
  try {
    // Get selected tenant, default to Dolese Ready Mix
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
      console.log("[Announcements API] No tenant selected, defaulting to:", selectedTenant);
    } else {
      console.log("[Announcements API] Selected tenant:", selectedTenant);
    }

    // Get tenant credentials and create client
    let tenantClient = null;
    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (tenantCreds && tenantCreds.supabase_url && tenantCreds.supabase_service_key) {
      tenantClient = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      console.log("[Announcements API] Connected to tenant:", selectedTenant);
    } else {
      console.log("[Announcements API] Could not get credentials for tenant:", selectedTenant);
    }

    // Get campaigns from main database
    const { data: campaigns, error: campaignsError } = await supabaseServer
      .from("campaigns")
      .select("id, name, description")
      .order("name");

    if (campaignsError) {
      console.error("Error fetching campaigns:", campaignsError);
    }

    // Get plants and regions from tenant database for "company parts" list
    let organizations = [];
    if (tenantClient) {
      // Add DOLESE as first item (company-wide option)
      organizations.push({
        id: "DOLESE",
        name: "DOLESE",
        code: "DOLESE",
        type: "company"
      });

      // Fetch regions
      console.log("[Announcements API] Fetching regions from tenant database...");
      const { data: regions, error: regionsError } = await tenantClient
        .from("regions")
        .select("id, code, description")
        .order("description");

      if (regionsError) {
        console.error("Error fetching regions from tenant:", regionsError.message, regionsError.code);
      }
      if (regions && regions.length > 0) {
        console.log("[Announcements API] Found", regions.length, "regions");
        const regionItems = regions.map((r) => ({
          id: r.code || r.id,
          name: (r.description || r.code).toUpperCase(),
          code: r.code || r.id,
          type: "region"
        }));
        organizations = [...organizations, ...regionItems];
      }

      // Fetch plants
      console.log("[Announcements API] Fetching plants from tenant database...");
      const { data: plants, error: plantsError } = await tenantClient
        .from("plants")
        .select("id, code, description, short_description")
        .order("description");

      if (plantsError) {
        console.error("Error fetching plants from tenant:", plantsError);
      } else if (plants && plants.length > 0) {
        console.log("[Announcements API] Found", plants.length, "plants");
        const plantItems = plants.map((p) => ({
          id: p.code || p.id,
          name: (p.description || p.short_description || p.code).toUpperCase(),
          code: p.code || p.id,
          type: "plant"
        }));
        organizations = [...organizations, ...plantItems];
      }
    } else {
      console.log("[Announcements API] No tenant client, using fallback");
    }

    // Fallback to static organizations if no tenant data
    if (organizations.length === 0) {
      const { data: staticOrgs, error: orgsError } = await supabaseServer
        .from("organizations")
        .select("id, name, code")
        .order("name");

      if (orgsError) {
        console.error("Error fetching organizations:", orgsError);
      } else {
        organizations = staticOrgs || [];
      }
    }

    // Get static screens (JOBS, MARKETS, ORDER REQUEST DETAILS - matching D3 order)
    let screens = [];
    const { data: staticScreens, error: screensError } = await supabaseServer
      .from("screens")
      .select("id, name, code")
      .order("name");

    if (screensError) {
      console.error("Error fetching screens:", screensError);
    } else if (staticScreens) {
      // Use code as id for consistency with plant_code storage
      const mappedScreens = staticScreens.map(s => ({
        id: s.code || s.id,
        name: s.name,
        code: s.code
      }));

      // Sort to match D3 order: JOBS, MARKETS, ORDER REQUEST DETAILS
      const screenOrder = ['JOBS', 'MARKETS', 'ORDER REQUEST DETAILS'];
      screens = mappedScreens.sort((a, b) => {
        const aIndex = screenOrder.indexOf(a.name);
        const bIndex = screenOrder.indexOf(b.name);
        // Items not in the order list go to the end
        const aPos = aIndex === -1 ? 999 : aIndex;
        const bPos = bIndex === -1 ? 999 : bIndex;
        return aPos - bPos;
      });
    }

    // Get announcements from tenant database
    let announcements = [];
    if (tenantClient) {
      const { data: tenantAnnouncements, error: announcementsError } = await tenantClient
        .from("announcements")
        .select("id, name, is_published")
        .order("created_at", { ascending: false });

      if (announcementsError) {
        console.error("Error fetching announcements:", announcementsError);
      } else {
        announcements = tenantAnnouncements || [];
      }
    }

    return NextResponse.json({
      success: true,
      tenant: selectedTenant,
      data: {
        campaigns: campaigns || [],
        organizations: organizations,
        screens: screens,
        announcements: announcements || []
      }
    });
  } catch (error) {
    console.error("Error in GET /api/announcements:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/announcements
 * Create a new announcement
 */
export async function POST(request) {
  try {
    // Get tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return NextResponse.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500 }
      );
    }

    const tenantClient = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();

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

    // Insert announcement to tenant database
    const { data: announcement, error: announcementError } = await tenantClient
      .from("announcements")
      .insert({
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
      .select()
      .single();

    if (announcementError) {
      console.error("Error creating announcement:", announcementError);
      return NextResponse.json(
        { success: false, error: announcementError.message },
        { status: 400 }
      );
    }

    // Insert organization/zone associations
    if (organizations && organizations.length > 0) {
      const orgInserts = organizations.map(zone => ({
        announcement_id: announcement.id,
        zone_name: zone
      }));

      await tenantClient
        .from("announcement_organizations")
        .insert(orgInserts);
    }

    // Insert screen/plant associations
    if (screens && screens.length > 0) {
      const screenInserts = screens.map(plant => ({
        announcement_id: announcement.id,
        plant_code: plant
      }));

      await tenantClient
        .from("announcement_screens")
        .insert(screenInserts);
    }

    return NextResponse.json({
      success: true,
      data: announcement,
      message: "Announcement created successfully"
    });
  } catch (error) {
    console.error("Error in POST /api/announcements:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
