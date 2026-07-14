import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/products/[id]
 * Get product details by ID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    console.log("[Product Detail API] Getting product:", id, "projectId:", projectId);

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Try to find product in project_mix_products first
    let product = null;

    if (projectId) {
      // Get specific product for a project
      const { data, error } = await supabase
        .from("project_mix_products")
        .select("*")
        .eq("project_id", projectId)
        .eq("item_id", parseInt(id, 10) || 0)
        .maybeSingle();

      if (!error && data) {
        product = data;
      }
    }

    // If not found by project, try by item_id
    if (!product) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .select("*")
        .eq("item_id", parseInt(id, 10) || 0)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        product = data;
      }
    }

    // Try by item_code
    if (!product) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .select("*")
        .eq("item_code", id)
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        product = data;
      }
    }

    // Try by primary key id
    if (!product) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .select("*")
        .eq("id", parseInt(id, 10) || 0)
        .maybeSingle();

      if (!error && data) {
        product = data;
      }
    }

    if (!product) {
      return Response.json(
        { error: "Product not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[Product Detail API] Found product:", product.item_code);

    return Response.json(
      {
        product: {
          id: String(product.id),
          item_id: product.item_id,
          item_code: product.item_code || "",
          short_description: product.short_description || "",
          description: product.description || "",
          plant_id: product.plant_id,
          plant_code: product.plant_code || "",
          category: product.batch_code || "CONCRETE",
          uom: product.estimated_quantity_unit_code || "CY",
          slump: product.slump,
          usage_code: product.usage_code,
          price: product.price,
          price_unit: product.price_unit,
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Product Detail API] Error:", error);
    return Response.json(
      { error: "Failed to get product details" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/products/[id]
 * Update product details
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  try {
    const { id } = await params;
    const body = await request.json();

    console.log("[Product Detail API] Updating product:", id, body);

    const { project_id, description, category, uom } = body;

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (description !== undefined) {
      updateData.description = description;
      updateData.short_description = description;
    }

    if (category !== undefined) {
      updateData.batch_code = category;
    }

    if (uom !== undefined) {
      updateData.estimated_quantity_unit_code = uom;
    }

    // Try to update by different ID types
    let updated = false;

    // Try by primary key id
    if (!updated) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .update(updateData)
        .eq("id", parseInt(id, 10) || 0)
        .select("id")
        .maybeSingle();

      if (!error && data) {
        updated = true;
      }
    }

    // Try by item_id if project_id provided
    if (!updated && project_id) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .update(updateData)
        .eq("project_id", project_id)
        .eq("item_id", parseInt(id, 10) || 0)
        .select("id")
        .maybeSingle();

      if (!error && data) {
        updated = true;
      }
    }

    // Try by item_code
    if (!updated) {
      const { data, error } = await supabase
        .from("project_mix_products")
        .update(updateData)
        .eq("item_code", id)
        .select("id");

      if (!error && data && data.length > 0) {
        updated = true;
      }
    }

    if (!updated) {
      return Response.json(
        { error: "Product not found or update failed" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[Product Detail API] Product updated successfully");

    return Response.json(
      { success: true, message: "Product updated successfully" },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Product Detail API] Update error:", error);
    return Response.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}
