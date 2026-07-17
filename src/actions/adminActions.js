"use server";

/**
 * Admin actions for user management and search functionality.
 *
 * Status Logic (matching D3):
 * - logged_in (Green #458b00): User has last_login_at - "LOGGED IN ON MM/DD/YY"
 * - signed_up (Yellow #f7bb00): User has created_at but no last_login_at and no invitation_sent_at - "SIGNED UP MM/DD/YY"
 * - invited (Red #c43926): User has invitation_sent_at but no last_login_at - "INVITED ON MM/DD/YY"
 * - deleted (Red #c43926): User is_deleted = true - "DELETED BY [name]"
 */

import supabaseServer from "@/supabase/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";

// Helper to get the appropriate Supabase client (tenant-specific or default)
async function getSupabaseClient() {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

/**
 * Format date as MM/DD/YY (matching D3 format)
 * @param {string|null} dateStr - ISO date string
 * @returns {string|null} - Formatted date or null
 */
function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

/**
 * Determine user status based on login, invitation, and signup dates
 * Matches D3's exact logic:
 * - Green (logged_in): has last_login_at
 * - Yellow (signed_up): has signup but no login and no invitation
 * - Red (invited): has invitation but no login
 * - Red (deleted): is_deleted flag
 *
 * @param {object} user - User object with dates
 * @returns {object} - Status info with type, label, and date
 */
function getUserStatus(user) {
  // Check if deleted first
  if (user.is_deleted) {
    return {
      type: "deleted",
      label: "DELETED BY " + (user.deleted_by || "Admin"),
      date: formatDate(user.deleted_at),
      sub: user.deleted_at ? "Deleted by Date: " + formatDate(user.deleted_at) : null
    };
  }

  // User has logged in - Green with Completed icon
  if (user.last_login_at) {
    return {
      type: "logged_in",
      label: "LOGGED IN ON",
      date: formatDate(user.last_login_at)
    };
  }

  // User was invited but never logged in - Red with Scheduled icon
  if (user.invitation_sent_at) {
    return {
      type: "invited",
      label: "INVITED ON",
      date: formatDate(user.invitation_sent_at)
    };
  }

  // User signed up but never logged in (no invitation) - Yellow with Paused icon
  if (user.created_at) {
    return {
      type: "signed_up",
      label: "SIGNED UP",
      date: formatDate(user.created_at)
    };
  }

  // Default fallback - treat as invited
  return {
    type: "invited",
    label: "INVITED ON",
    date: null
  };
}

/**
 * Search users by name, email, or phone number.
 * Used by the Admin User Search page.
 * @param {string} q - Search query
 * @returns {Promise<Array>} - Array of user objects with status
 */
export async function searchAdminUsers(q) {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();
  if (!term) return [];

  const supabase = await getSupabaseClient();

  // Select fields needed for status determination
  const { data: users, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone_number, last_login_at, invitation_sent_at, created_at")
    .or(`full_name.ilike.%${term}%,email.ilike.%${term}%,phone_number.ilike.%${term}%`)
    .order("full_name", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[ERROR] searchAdminUsers:", error.message);
    return [];
  }

  return (users || []).map((u) => {
    const status = getUserStatus(u);
    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      phone: u.phone_number,
      // Status fields for tile rendering
      status: status.type,
      status_label: status.label,
      status_date: status.date
    };
  });
}

/**
 * Get user details by ID.
 * Used by the Admin User Details page.
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} - User object with all details
 */
export async function getAdminUserDetails(userId) {
  console.log("========== [ADMIN USER DETAILS] START ==========");
  console.log("[ADMIN USER DETAILS] Getting details for userId:", userId);

  if (!userId) {
    console.log("[ADMIN USER DETAILS] No userId provided");
    return null;
  }

  console.log("[ADMIN USER DETAILS] Getting supabase client...");
  const supabase = await getSupabaseClient();
  console.log("[ADMIN USER DETAILS] Supabase client:", supabase ? "OK" : "NULL");

  if (!supabase) {
    console.error("[ERROR] getAdminUserDetails: No database connection");
    return null;
  }

  // Get user details (only select columns that exist)
  console.log("[ADMIN USER DETAILS] Querying users table...");
  const { data: user, error } = await supabase
    .from("users")
    .select("id, first_name, last_name, full_name, email, title, phone_number, last_login_at, invitation_sent_at, created_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  console.log("[ADMIN USER DETAILS] Query result:", {
    hasUser: !!user,
    userId: user?.id,
    email: user?.email,
    error: error?.message || null,
    errorCode: error?.code || null
  });

  if (error) {
    console.error("[ERROR] getAdminUserDetails:", error.message, error);
    return null;
  }

  if (!user) {
    console.log("[ADMIN USER DETAILS] No user found");
    return null;
  }

  // Get user's primary customer (first assignment)
  const { data: customerLink } = await supabase
    .from("user_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();

  let customerName = null;
  let customerId = null;

  if (customerLink?.customer_id) {
    customerId = customerLink.customer_id;
    const { data: customer } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();
    customerName = customer?.name || null;
  }

  const status = getUserStatus(user);

  // Get tenant name from settings or environment
  let tenantName = "DOLESE"; // Default
  try {
    const { data: tenantSettings } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "tenant_name")
      .maybeSingle();
    if (tenantSettings?.value) {
      tenantName = tenantSettings.value;
    }
  } catch (e) {
    // Ignore error, use default
  }

  return {
    id: user.id,
    first_name: user.first_name || "",
    last_name: user.last_name || "",
    name: user.full_name || "",
    email: user.email || "",
    phone: user.phone_number || "",
    title: user.title || "",
    measurement_system: "STANDARD",
    last_login_at: user.last_login_at,
    invitation_sent_at: user.invitation_sent_at,
    created_at: user.created_at,
    customer_id: customerId,
    customer_name: customerName,
    tenant_name: tenantName,
    status: status.type,
    status_label: status.label,
    status_date: status.date,
    // Additional flags (default values, can be expanded later)
    forced_logout: false,
    has_order_access: false
  };
}

/**
 * Get user notification preferences within a date range.
 * Used by the Admin User Notifications page.
 * Queries from user_notification_preferences table with joins to get channel and event type details.
 * @param {string} userId - User ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Promise<Array>} - Array of notification preference objects
 */
export async function getUserNotifications(userId, startDate, endDate) {
  console.log("[USER NOTIFICATIONS] Getting notifications for userId:", userId);
  console.log("[USER NOTIFICATIONS] Date range:", startDate, "to", endDate);

  if (!userId) {
    console.log("[USER NOTIFICATIONS] No userId provided");
    return [];
  }

  const supabase = await getSupabaseClient();

  if (!supabase) {
    console.error("[ERROR] getUserNotifications: No database connection");
    return [];
  }

  // First, get the channel and event type lookup tables
  const [channelsResult, eventTypesResult] = await Promise.all([
    supabase.from("notification_channels").select("*"),
    supabase.from("notification_event_types").select("*")
  ]);

  // Build lookup maps
  const channelMap = {};
  (channelsResult.data || []).forEach(c => {
    channelMap[c.id] = c;
  });

  const eventTypeMap = {};
  (eventTypesResult.data || []).forEach(e => {
    eventTypeMap[e.id] = e;
  });

  console.log("[USER NOTIFICATIONS] Loaded", Object.keys(channelMap).length, "channels and", Object.keys(eventTypeMap).length, "event types");

  // Query user_notification_preferences
  // Note: We don't filter by date since these are preference settings, not sent notifications
  let query = supabase
    .from("user_notification_preferences")
    .select(`
      id,
      user_id,
      event_type_id,
      channel_id,
      is_enabled,
      scope_type,
      scope_id,
      created_at,
      updated_at
    `)
    .eq("user_id", userId);

  // Order by most recent first
  query = query.order("created_at", { ascending: false });

  const { data: notifications, error } = await query;

  if (error) {
    console.error("[ERROR] getUserNotifications:", error.message);
    // If table doesn't exist, return empty array
    if (error.code === "42P01" || error.message.includes("does not exist")) {
      console.log("[USER NOTIFICATIONS] user_notification_preferences table does not exist, returning empty array");
      return [];
    }
    return [];
  }

  console.log("[USER NOTIFICATIONS] Found", notifications?.length || 0, "notification preferences");

  return (notifications || []).map((n) => {
    // Get channel info from lookup
    const channel = channelMap[n.channel_id] || {};
    const channelName = channel.name || channel.code || channel.channel_name || `Channel ${n.channel_id}`;
    const channelType = channelName.toUpperCase();

    // Get event type info from lookup
    const eventType = eventTypeMap[n.event_type_id] || {};
    const eventTypeName = eventType.name || eventType.event_name || eventType.description || `Event ${n.event_type_id}`;

    return {
      id: n.id,
      user_id: n.user_id,
      type: channelType,
      notification: eventTypeName,
      message: eventTypeName,
      is_enabled: n.is_enabled,
      scope_type: n.scope_type || "global",
      scope_id: n.scope_id || "",
      sent_at: n.updated_at,
      created_at: n.created_at,
      // Additional fields for display
      order_number: "",
      order_id: null,
      job_access: n.is_enabled ? "Yes" : "No",
      project_access: n.scope_type === "project" ? "Yes" : "No",
      project_name: n.scope_type === "project" ? n.scope_id : "",
      project_id: n.scope_type === "project" ? n.scope_id : null,
      customer_name: n.scope_type === "customer" ? n.scope_id : "",
      customer_id: n.scope_type === "customer" ? n.scope_id : null,
      // Channel and event type details
      channel_id: n.channel_id,
      channel_name: channelName,
      event_type_id: n.event_type_id,
      event_type_name: eventTypeName
    };
  });
}
