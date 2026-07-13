export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";
import { getSelectedTenant, getTenantCredentials } from "@/actions/tenantActions";

/**
 * POST /api/admin/internal/invite
 * Send an invitation to an internal user
 */
export async function POST(request) {
  try {
    // Get selected tenant and create tenant client
    let selectedTenant = await getSelectedTenant();
    if (!selectedTenant) {
      selectedTenant = "Dolese Ready Mix";
    }

    const tenantCreds = await getTenantCredentials(selectedTenant);
    if (!tenantCreds || !tenantCreds.supabase_url || !tenantCreds.supabase_service_key) {
      return Response.json(
        { success: false, error: "Could not connect to tenant database" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(tenantCreds.supabase_url, tenantCreds.supabase_service_key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await request.json();
    const { firstName, lastName, email, title, phone, measurementSystem, roleId } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !phone) {
      return Response.json(
        { success: false, error: "Missing required fields" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("id, email")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return Response.json(
        { success: false, error: "A user with this email already exists" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Create the internal user record
    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        email: email.toLowerCase(),
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        title: title || null,
        phone: phone,
        measurement_system: measurementSystem || "standard",
        role_id: roleId || null,
        user_type: "internal",
        status: "invited",
        invitation_sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error("[INTERNAL INVITE] Error creating user:", insertError.message);
      return Response.json(
        { success: false, error: insertError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // TODO: Send invitation email
    // This would typically integrate with an email service like SendGrid, AWS SES, etc.
    console.log("[INTERNAL INVITE] User created:", newUser.id, "- Email invitation would be sent to:", email);

    return Response.json(
      {
        success: true,
        data: newUser,
        message: "Internal user invitation sent successfully"
      },
      { headers: { "cache-control": "no-store" } }
    );

  } catch (error) {
    console.error("[ERROR] /api/admin/internal/invite:", error);
    return Response.json(
      { success: false, error: "Failed to send invitation" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
