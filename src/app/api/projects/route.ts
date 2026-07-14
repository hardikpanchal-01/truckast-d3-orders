import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * POST /api/projects
 * Create a new project for a customer
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    console.log("[Projects API] Creating project:", body);

    const {
      customer_id,
      name,
      code,
      address,
      city,
      state,
      is_active,
      restricted_products,
      setup_date,
      expiration_date,
      product_ids,
    } = body;

    // Validation
    if (!customer_id) {
      return Response.json(
        { error: "Customer ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!name || !name.trim()) {
      return Response.json(
        { error: "Project name is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    if (!code || !code.trim()) {
      return Response.json(
        { error: "Project code/number is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Projects API] No tenant database connection");
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get customer info first
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, code, name")
      .eq("id", customer_id)
      .single();

    if (customerError || !customer) {
      console.error("[Projects API] Customer not found:", customerError);
      return Response.json(
        { error: "Customer not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Check if project code already exists for this customer
    const { data: existingProject } = await supabase
      .from("projects")
      .select("id")
      .eq("customer_id", customer_id)
      .eq("code", code.trim())
      .maybeSingle();

    if (existingProject) {
      return Response.json(
        { error: "A project with this code already exists for this customer" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Create the project
    const projectData: Record<string, unknown> = {
      customer_id: customer_id,
      customer_code: customer.code,
      customer_name: customer.name,
      name: name.trim(),
      code: code.trim(),
      address: address?.trim() || null,
      city: city?.trim() || null,
      state: state?.trim() || null,
      inactive: is_active === false,
      restricted: restricted_products === true,
      setup_date: setup_date || null,
      expiration_date: expiration_date || null,
    };

    console.log("[Projects API] Inserting project:", projectData);

    const { data: newProject, error: insertError } = await supabase
      .from("projects")
      .insert(projectData)
      .select("id, code, name")
      .single();

    if (insertError) {
      console.error("[Projects API] Insert error:", insertError);
      return Response.json(
        { error: "Failed to create project: " + insertError.message },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    console.log("[Projects API] Project created:", newProject);

    // If product_ids were provided, associate them with the project
    if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      console.log("[Projects API] Associating products:", product_ids);

      // Get product details from existing project_mix_products
      const { data: sourceProducts } = await supabase
        .from("project_mix_products")
        .select("item_id, item_code, short_description, description, plant_id, plant_code, estimated_quantity_unit_code")
        .in("item_id", product_ids.map((id: string) => parseInt(id, 10) || 0))
        .limit(500);

      // Create a map of product details
      const productDetailsMap = new Map<string, Record<string, unknown>>();
      for (const p of sourceProducts || []) {
        productDetailsMap.set(String(p.item_id), p);
      }

      // Also try to match by item_code
      if (sourceProducts && sourceProducts.length === 0) {
        const { data: sourceByCode } = await supabase
          .from("project_mix_products")
          .select("item_id, item_code, short_description, description, plant_id, plant_code, estimated_quantity_unit_code")
          .in("item_code", product_ids)
          .limit(500);

        for (const p of sourceByCode || []) {
          productDetailsMap.set(String(p.item_code), p);
        }
      }

      // Create project_mix_products entries
      const projectMixProducts = product_ids.map((productId: string) => {
        const details = productDetailsMap.get(productId) || {};
        return {
          project_id: newProject.id,
          item_id: details.item_id || (parseInt(productId, 10) || null),
          item_code: details.item_code || productId,
          short_description: details.short_description || null,
          description: details.description || null,
          plant_id: details.plant_id || null,
          plant_code: details.plant_code || null,
          estimated_quantity_unit_code: details.estimated_quantity_unit_code || "CY",
        };
      });

      console.log("[Projects API] Inserting project_mix_products:", projectMixProducts.length);

      const { error: productsError } = await supabase
        .from("project_mix_products")
        .insert(projectMixProducts);

      if (productsError) {
        console.warn("[Projects API] Failed to associate products:", productsError);
        // Don't fail the whole operation, just log the warning
      }
    }

    return Response.json(
      {
        success: true,
        project: {
          id: String(newProject.id),
          code: newProject.code,
          name: newProject.name,
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Projects API] Error:", error);
    return Response.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
