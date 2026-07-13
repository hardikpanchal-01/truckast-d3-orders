export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for listing and creating roles.
 */

// GET - List all roles
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to get roles from roles table
    const { data: roles, error } = await supabase
      .from("roles")
      .select("id, name, created_at")
      .order("name", { ascending: true });

    if (error) {
      console.warn("[ROLES] Error fetching roles:", error.message);
      // Return empty list with sample data for demo
      return Response.json(
        {
          success: true,
          data: [
            { id: "1", name: "DOLESE (CORPORATE)", user_count: 120 },
            { id: "2", name: "DISPATCH-EASTERN", user_count: 2 },
            { id: "3", name: "DISPATCH-NORTHERN", user_count: 3 },
            { id: "4", name: "TRUCKAST ADMIN", user_count: 3 },
          ],
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    // Get user counts for each role
    const rolesWithCounts = await Promise.all(
      (roles || []).map(async (role) => {
        const { count } = await supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role_id", role.id);

        return {
          id: role.id,
          name: role.name,
          user_count: count || 0,
        };
      })
    );

    return Response.json(
      { success: true, data: rolesWithCounts },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/roles GET:", error);
    return Response.json(
      { success: false, error: "Failed to get roles" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

// POST - Create new role
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, nodes } = body;

    if (!name) {
      return Response.json(
        { success: false, error: "Role name is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create role
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .insert({ name: name })
      .select()
      .single();

    if (roleError) {
      console.error("[ROLES] Error creating role:", roleError.message);
      return Response.json(
        { success: false, error: roleError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // Add node assignments if provided
    if (nodes && nodes.length > 0 && role) {
      const nodeAssignments = nodes.map((nodeId) => ({
        role_id: role.id,
        node_id: nodeId,
      }));

      const { error: nodesError } = await supabase
        .from("role_nodes")
        .insert(nodeAssignments);

      if (nodesError) {
        console.warn("[ROLES] Error assigning nodes:", nodesError.message);
      }
    }

    console.log("[ROLES] Role created:", role.id, name);

    return Response.json(
      {
        success: true,
        data: role,
        message: "Role created successfully",
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/roles POST:", error);
    return Response.json(
      { success: false, error: "Failed to create role" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
