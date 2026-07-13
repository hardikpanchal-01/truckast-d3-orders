/**
 * User Sync Service
 *
 * Syncs user password updates across:
 * - Main DB: Current tenant's Supabase
 * - Auth DB: Central authentication database
 * - All Tenants: Cross-tenant password sync
 */

import supabaseAuthServer from "@/supabase/auth-server";
import { createClient } from "@supabase/supabase-js";
import { decrypt } from "@/lib/encryption";

// Default password hash for "123456" (bcrypt)
const DEFAULT_PASSWORD_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

/**
 * Find a user by email using Admin API with pagination
 * This handles cases where there are more than 1000 users
 * @param {import("@supabase/supabase-js").SupabaseClient} client
 * @param {string} email
 * @returns {Promise<{user: import("@supabase/supabase-js").User | null, error: Error | null}>}
 */
async function findUserByEmail(client, email) {
  const normalizedEmail = email.toLowerCase();
  let page = 1;
  const perPage = 1000;

  try {
    while (true) {
      const { data, error } = await client.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        return { user: null, error };
      }

      if (!data?.users || data.users.length === 0) {
        // No more users to check
        return { user: null, error: null };
      }

      // Find user in current page
      const foundUser = data.users.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );

      if (foundUser) {
        return { user: foundUser, error: null };
      }

      // If we got less than perPage users, we've reached the end
      if (data.users.length < perPage) {
        return { user: null, error: null };
      }

      page++;
    }
  } catch (err) {
    return {
      user: null,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

/**
 * Update password in Central Auth DB
 * @param {string} email - User's email
 * @param {string} newPassword - New password
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function updatePasswordInAuthDb(email, newPassword) {
  console.log(
    "[AUTH DB PASSWORD] Starting password update for email:",
    email
  );

  try {
    // Check Auth DB environment
    const authDbUrl = process.env.NEXT_AUTH_PUBLIC_SUPABASE_URL;
    const authDbKey = process.env.NEXT_AUTH_SUPABASE_SERVICE_ROLE_KEY;

    if (!authDbUrl || !authDbKey) {
      console.log("[AUTH DB PASSWORD] Auth DB not configured, skipping sync");
      return { success: true }; // Not an error, just not configured
    }

    // Find user in auth_tenant.users by email to get their UUID
    const { data: authTenantUser, error: findError } = await supabaseAuthServer
      .schema("auth_tenant")
      .from("users")
      .select("uuid, email")
      .eq("email", email)
      .maybeSingle();

    if (findError) {
      console.error(
        "[AUTH DB PASSWORD] Error finding user in auth_tenant.users:",
        findError.message
      );
      return { success: false, error: findError.message };
    }

    if (authTenantUser?.uuid) {
      // Update password in auth.users using admin API with the UUID
      console.log(
        "[AUTH DB PASSWORD] Found user UUID:",
        authTenantUser.uuid,
        "- updating password..."
      );
      const { error: updateAuthError } =
        await supabaseAuthServer.auth.admin.updateUserById(authTenantUser.uuid, {
          password: newPassword,
        });

      if (updateAuthError) {
        console.error(
          "[AUTH DB PASSWORD] Error updating auth.users password:",
          updateAuthError.message
        );
        return { success: false, error: updateAuthError.message };
      }

      console.log("[AUTH DB PASSWORD] auth.users password updated successfully");

      // Also update auth_tenant.users password_hash for consistency
      console.log(
        "[AUTH DB PASSWORD] Updating auth_tenant.users password_hash..."
      );
      const { error: updatePublicError } = await supabaseAuthServer
        .schema("auth_tenant")
        .from("users")
        .update({
          password_hash: DEFAULT_PASSWORD_HASH, // Will be overwritten by trigger from auth.users
          updated_at: new Date().toISOString(),
        })
        .eq("email", email);

      if (updatePublicError) {
        console.error(
          "[AUTH DB PASSWORD] Error updating auth_tenant.users:",
          updatePublicError.message
        );
        // Don't fail - auth.users update is more important
      } else {
        console.log("[AUTH DB PASSWORD] auth_tenant.users updated successfully");
      }
    } else {
      console.log(
        "[AUTH DB PASSWORD] User not found in Auth DB auth_tenant.users"
      );
    }

    return { success: true };
  } catch (error) {
    console.error("[AUTH DB PASSWORD] Exception:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Update password in ALL tenants where the user has access
 * This enables cross-tenant password sync when user resets password in one tenant
 *
 * @param {string} email - User's email
 * @param {string} newPassword - New password
 * @param {string} [currentTenantUrl] - Optional: skip this tenant (already updated)
 * @returns {Promise<{success: boolean, updatedTenants: string[], createdTenants: string[], errors: string[]}>}
 */
export async function updatePasswordInAllTenants(
  email,
  newPassword,
  currentTenantUrl
) {
  console.log("[CROSS-TENANT SYNC] ========== Starting ==========");
  console.log("[CROSS-TENANT SYNC] Email:", email);
  console.log("[CROSS-TENANT SYNC] Current tenant URL to skip:", currentTenantUrl);

  const result = {
    success: false,
    updatedTenants: [],
    createdTenants: [],
    errors: [],
  };

  try {
    // Check Auth DB environment
    const authDbUrl = process.env.NEXT_AUTH_PUBLIC_SUPABASE_URL;
    const authDbKey = process.env.NEXT_AUTH_SUPABASE_SERVICE_ROLE_KEY;

    if (!authDbUrl || !authDbKey) {
      console.log("[CROSS-TENANT SYNC] Auth DB not configured, skipping");
      result.success = true; // Not an error, just not configured
      return result;
    }

    // First, get the user from Auth DB to find which tenants they have access to
    const { data: authTenantUser, error: userError } = await supabaseAuthServer
      .schema("auth_tenant")
      .from("users")
      .select("id, uuid, full_name")
      .eq("email", email)
      .maybeSingle();

    if (userError) {
      console.log(
        "[CROSS-TENANT SYNC] Error finding user in Auth DB:",
        userError.message
      );
    }

    // Get tenants where user has access (via tenant_users)
    let userTenantIds = [];
    if (authTenantUser) {
      const { data: tenantUsers, error: tenantUsersError } =
        await supabaseAuthServer
          .schema("auth_tenant")
          .from("tenant_users")
          .select("tenant_id")
          .eq("user_id", authTenantUser.id)
          .eq("status", "active");

      if (!tenantUsersError && tenantUsers) {
        userTenantIds = tenantUsers.map((tu) => tu.tenant_id);
        console.log(
          "[CROSS-TENANT SYNC] User has access to tenant IDs:",
          userTenantIds
        );
      }
    }

    // Get ALL active tenants with credentials
    console.log("[CROSS-TENANT SYNC] Fetching all active tenants...");
    const { data: tenants, error: tenantsError } = await supabaseAuthServer
      .schema("auth_tenant")
      .from("tenants")
      .select("id, name, supabase_url, supabase_service_key")
      .eq("status", "active")
      .is("deleted_at", null);

    if (tenantsError || !tenants || tenants.length === 0) {
      console.log(
        "[CROSS-TENANT SYNC] No active tenants found:",
        tenantsError?.message
      );
      result.success = true;
      return result;
    }

    console.log("[CROSS-TENANT SYNC] Found", tenants.length, "active tenants");

    // Update/create user in each tenant
    for (const tenant of tenants) {
      try {
        // Skip if this is the current tenant (already updated)
        if (currentTenantUrl && tenant.supabase_url === currentTenantUrl) {
          console.log(
            `[CROSS-TENANT SYNC] Skipping ${tenant.name} (current tenant)`
          );
          continue;
        }

        if (!tenant.supabase_url || !tenant.supabase_service_key) {
          console.log(
            `[CROSS-TENANT SYNC] ${tenant.name}: Missing credentials, skipping`
          );
          continue;
        }

        // Decrypt service key
        console.log(
          `[CROSS-TENANT SYNC] ${tenant.name}: Decrypting service key...`
        );
        const decryptedKey = decrypt(tenant.supabase_service_key);
        console.log(
          `[CROSS-TENANT SYNC] ${tenant.name}: Decrypted key length:`,
          decryptedKey?.length
        );
        console.log(
          `[CROSS-TENANT SYNC] ${tenant.name}: Key starts with 'eyJ':`,
          decryptedKey?.startsWith("eyJ")
        );

        // Check if decryption failed (returned encrypted value)
        if (decryptedKey?.includes(":") && decryptedKey?.length > 100) {
          console.log(
            `[CROSS-TENANT SYNC] ${tenant.name}: DECRYPTION FAILED - key still encrypted!`
          );
          result.errors.push(
            `${tenant.name}: Decryption failed - key still encrypted`
          );
          continue;
        }

        if (!decryptedKey) {
          console.log(
            `[CROSS-TENANT SYNC] ${tenant.name}: Failed to decrypt service key`
          );
          result.errors.push(`${tenant.name}: Failed to decrypt credentials`);
          continue;
        }

        // Create tenant Supabase client
        const tenantClient = createClient(tenant.supabase_url, decryptedKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        // Find user in tenant's auth.users by email (with pagination support)
        const { user: tenantUser, error: findError } = await findUserByEmail(
          tenantClient,
          email
        );

        if (findError) {
          console.log(
            `[CROSS-TENANT SYNC] ${tenant.name}: Error finding user:`,
            findError.message
          );
          result.errors.push(`${tenant.name}: ${findError.message}`);
          continue;
        }

        if (!tenantUser) {
          // User doesn't exist in this tenant - SKIP (don't create)
          // Password reset should only update existing users, not create new ones
          console.log(
            `[CROSS-TENANT SYNC] ${tenant.name}: User doesn't exist in this tenant, skipping`
          );
          continue;
        } else {
          // User exists - update password and confirm email
          const { error: updateError } =
            await tenantClient.auth.admin.updateUserById(tenantUser.id, {
              password: newPassword,
              email_confirm: true,
            });

          if (updateError) {
            console.log(
              `[CROSS-TENANT SYNC] ${tenant.name}: Update failed:`,
              updateError.message
            );
            result.errors.push(`${tenant.name}: ${updateError.message}`);
          } else {
            console.log(
              `[CROSS-TENANT SYNC] ${tenant.name}: Password updated successfully`
            );
            result.updatedTenants.push(tenant.name);
          }
        }
      } catch (tenantError) {
        const errorMsg =
          tenantError instanceof Error ? tenantError.message : "Unknown error";
        console.error(
          `[CROSS-TENANT SYNC] ${tenant.name}: Exception:`,
          errorMsg
        );
        result.errors.push(`${tenant.name}: ${errorMsg}`);
      }
    }

    result.success = true;
    console.log("[CROSS-TENANT SYNC] ========== Complete ==========");
    console.log("[CROSS-TENANT SYNC] Updated tenants:", result.updatedTenants);
    console.log("[CROSS-TENANT SYNC] Created tenants:", result.createdTenants);
    console.log("[CROSS-TENANT SYNC] Errors:", result.errors);

    return result;
  } catch (error) {
    console.error("[CROSS-TENANT SYNC] Exception:", error);
    result.errors.push(
      error instanceof Error ? error.message : "Unknown error"
    );
    return result;
  }
}

const userSyncService = {
  updatePasswordInAuthDb,
  updatePasswordInAllTenants,
};

export default userSyncService;
