export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for getting and updating a specific role.
 */

// GET - Get role details
export async function GET(request, { params }) {
  try {
    const { roleId } = await params;

    if (!roleId) {
      return Response.json(
        { success: false, error: "Role ID is required" },
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

    // Get role
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id, name, created_at")
      .eq("id", roleId)
      .single();

    if (roleError) {
      console.error("[ROLES] Error fetching role:", roleError.message);
      return Response.json(
        { success: false, error: "Role not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get assigned nodes
    const { data: roleNodes, error: nodesError } = await supabase
      .from("role_nodes")
      .select("node_id")
      .eq("role_id", roleId);

    if (nodesError) {
      console.warn("[ROLES] Error fetching role nodes:", nodesError.message);
    }

    const nodes = (roleNodes || []).map((rn) => rn.node_id);

    return Response.json(
      {
        success: true,
        data: {
          id: role.id,
          name: role.name,
          created_at: role.created_at,
          nodes: nodes,
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/roles/[roleId] GET:", error);
    return Response.json(
      { success: false, error: "Failed to get role" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}

// PUT - Update role
export async function PUT(request, { params }) {
  try {
    const { roleId } = await params;
    const body = await request.json();
    const { name, nodes } = body;

    if (!roleId) {
      return Response.json(
        { success: false, error: "Role ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

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

    // Update role name
    const { error: updateError } = await supabase
      .from("roles")
      .update({ name: name, updated_at: new Date().toISOString() })
      .eq("id", roleId);

    if (updateError) {
      console.error("[ROLES] Error updating role:", updateError.message);
      return Response.json(
        { success: false, error: updateError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    // Update node assignments
    // First, delete existing assignments
    const { error: deleteError } = await supabase
      .from("role_nodes")
      .delete()
      .eq("role_id", roleId);

    if (deleteError) {
      console.warn("[ROLES] Error deleting old nodes:", deleteError.message);
    }

    // Then add new assignments
    if (nodes && nodes.length > 0) {
      const nodeAssignments = nodes.map((nodeId) => ({
        role_id: roleId,
        node_id: nodeId,
      }));

      const { error: nodesError } = await supabase
        .from("role_nodes")
        .insert(nodeAssignments);

      if (nodesError) {
        console.warn("[ROLES] Error assigning nodes:", nodesError.message);
      }
    }

    console.log("[ROLES] Role updated:", roleId, name);

    return Response.json(
      {
        success: true,
        message: "Role updated successfully",
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/roles/[roleId] PUT:", error);
    return Response.json(
      { success: false, error: "Failed to update role" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
