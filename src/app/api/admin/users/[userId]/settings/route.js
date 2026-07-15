import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users/[userId]/settings
 * Get user settings and notification preferences
 */
export async function GET(request, { params }) {
  const { userId } = await params;

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { success: false, error: "No tenant database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if user exists and get basic info
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, full_name, phone_number")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Try to get user settings from user_settings table
    let settings = {
      mobile: user.phone_number || "",
      time_format: "friendly",
      measurement_system: "STANDARD",
      timezone: "America/Chicago",
      market_summary_view: "COMPANY"
    };

    try {
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (userSettings) {
        settings = {
          mobile: userSettings.mobile || user.phone_number || "",
          time_format: userSettings.time_format || "friendly",
          measurement_system: userSettings.measurement_system || "STANDARD",
          timezone: userSettings.timezone || "America/Chicago",
          market_summary_view: userSettings.market_summary_view || "COMPANY"
        };
      }
    } catch (e) {
      console.log("[Settings API] user_settings table might not exist");
    }

    // Get notification event types and channels
    let eventTypes = [];
    let channels = [];
    let userPreferences = [];

    try {
      // Get all event types
      const { data: eventData } = await supabase
        .from("notification_event_types")
        .select("id, name, code")
        .order("id");
      eventTypes = eventData || [];

      // Get all channels
      const { data: channelData } = await supabase
        .from("notification_channels")
        .select("id, name, code")
        .order("id");
      channels = channelData || [];

      // Get user's notification preferences
      const { data: prefData } = await supabase
        .from("user_notification_preferences")
        .select("event_type_id, channel_id, is_enabled")
        .eq("user_id", userId);
      userPreferences = prefData || [];
    } catch (e) {
      console.log("[Settings API] Error fetching notification data:", e.message);
    }

    // Build notifications array for frontend
    // Create a lookup map for user preferences
    const prefLookup = {};
    userPreferences.forEach(p => {
      const key = `${p.event_type_id}_${p.channel_id}`;
      prefLookup[key] = p.is_enabled;
    });

    // Find channel IDs for email and sms
    const emailChannel = channels.find(c => c.code === 'email' || c.name?.toLowerCase() === 'email');
    const smsChannel = channels.find(c => c.code === 'sms' || c.name?.toLowerCase() === 'sms');
    const emailChannelId = emailChannel?.id;
    const smsChannelId = smsChannel?.id;

    // Build notifications list
    const notifications = eventTypes.map(et => {
      const emailKey = `${et.id}_${emailChannelId}`;
      const smsKey = `${et.id}_${smsChannelId}`;

      return {
        event_type_id: et.id,
        notification_type: et.code || et.name,
        name: et.name,
        email_enabled: prefLookup[emailKey] || false,
        sms_enabled: prefLookup[smsKey] || false
      };
    });

    return Response.json(
      {
        success: true,
        settings,
        notifications,
        eventTypes,
        channels,
        user: { id: user.id, name: user.full_name }
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/admin/users/[userId]/settings:", error);
    return Response.json(
      { success: false, error: "Failed to get user settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

/**
 * POST /api/admin/users/[userId]/settings
 * Update user settings and notification preferences
 */
export async function POST(request, { params }) {
  const { userId } = await params;

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const body = await request.json();
    const { settings, notifications } = body;

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { success: false, error: "No tenant database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if user exists
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError || !user) {
      return Response.json(
        { success: false, error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Update phone number in users table if provided
    if (settings && settings.mobile) {
      await supabase
        .from("users")
        .update({ phone_number: settings.mobile })
        .eq("id", userId);
    }

    // Try to upsert user settings
    if (settings) {
      try {
        const settingsData = {
          user_id: userId,
          mobile: settings.mobile || null,
          time_format: settings.time_format || "friendly",
          measurement_system: settings.measurement_system || "STANDARD",
          timezone: settings.timezone || "America/Chicago",
          market_summary_view: settings.market_summary_view || "COMPANY",
          updated_at: new Date().toISOString()
        };

        const { error: upsertError } = await supabase
          .from("user_settings")
          .upsert(settingsData, { onConflict: "user_id" });

        if (upsertError) {
          console.log("[Settings API] Could not upsert user_settings:", upsertError.message);
        }
      } catch (e) {
        console.log("[Settings API] user_settings table might not exist:", e.message);
      }
    }

    // Update notification preferences using user_notification_preferences table
    if (notifications && Array.isArray(notifications)) {
      try {
        // Get channel IDs
        const { data: channels } = await supabase
          .from("notification_channels")
          .select("id, name, code");

        const emailChannel = (channels || []).find(c => c.code === 'email' || c.name?.toLowerCase() === 'email');
        const smsChannel = (channels || []).find(c => c.code === 'sms' || c.name?.toLowerCase() === 'sms');
        const emailChannelId = emailChannel?.id;
        const smsChannelId = smsChannel?.id;

        if (!emailChannelId && !smsChannelId) {
          console.log("[Settings API] No channels found");
        } else {
          // Process each notification preference
          for (const notif of notifications) {
            const eventTypeId = notif.event_type_id;

            if (!eventTypeId) continue;

            // Handle email preference
            if (emailChannelId) {
              // Check if preference exists
              const { data: existingEmail } = await supabase
                .from("user_notification_preferences")
                .select("id")
                .eq("user_id", userId)
                .eq("event_type_id", eventTypeId)
                .eq("channel_id", emailChannelId)
                .maybeSingle();

              if (existingEmail) {
                // Update existing
                await supabase
                  .from("user_notification_preferences")
                  .update({
                    is_enabled: notif.email_enabled || false,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existingEmail.id);
              } else {
                // Insert new
                await supabase
                  .from("user_notification_preferences")
                  .insert({
                    user_id: userId,
                    event_type_id: eventTypeId,
                    channel_id: emailChannelId,
                    is_enabled: notif.email_enabled || false,
                    scope_type: 'global'
                  });
              }
            }

            // Handle SMS preference
            if (smsChannelId) {
              // Check if preference exists
              const { data: existingSms } = await supabase
                .from("user_notification_preferences")
                .select("id")
                .eq("user_id", userId)
                .eq("event_type_id", eventTypeId)
                .eq("channel_id", smsChannelId)
                .maybeSingle();

              if (existingSms) {
                // Update existing
                await supabase
                  .from("user_notification_preferences")
                  .update({
                    is_enabled: notif.sms_enabled || false,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existingSms.id);
              } else {
                // Insert new
                await supabase
                  .from("user_notification_preferences")
                  .insert({
                    user_id: userId,
                    event_type_id: eventTypeId,
                    channel_id: smsChannelId,
                    is_enabled: notif.sms_enabled || false,
                    scope_type: 'global'
                  });
              }
            }
          }
        }
      } catch (e) {
        console.error("[Settings API] Error updating notifications:", e.message);
      }
    }

    return Response.json(
      { success: true, message: "Settings saved successfully" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] POST /api/admin/users/[userId]/settings:", error);
    return Response.json(
      { success: false, error: "Failed to save settings" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
