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
  if (!userId) return null;

  const supabase = await getSupabaseClient();

  // Get user details (only select columns that exist)
  const { data: user, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone_number, last_login_at, invitation_sent_at, created_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[ERROR] getAdminUserDetails:", error.message);
    return null;
  }

  if (!user) return null;

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
    name: user.full_name,
    email: user.email,
    phone: user.phone_number,
    title: "",
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
