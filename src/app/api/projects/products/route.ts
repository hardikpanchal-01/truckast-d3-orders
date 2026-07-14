import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

interface ProductRow {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  uom: string;
}

/**
 * GET /api/projects/products?customerId=...
 * Get products available for a customer (from project_mix_products and project_extra_products)
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    console.log("[Products API] Getting products for customer:", customerId);

    if (!customerId) {
      return Response.json(
        { error: "Customer ID is required", products: [] },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Products API] No tenant database connection");
      return Response.json(
        { error: "No database connection", products: [] },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const productMap = new Map<string, ProductRow>();

    // Get projects for this customer first
    const { data: projects } = await supabase
      .from("projects")
      .select("id")
      .eq("customer_id", customerId)
      .limit(100);

    const projectIds = (projects || []).map((p) => p.id);
    console.log("[Products API] Found", projectIds.length, "projects for customer");

    // 1. Try to get mix products from project_mix_products for customer's projects
    if (projectIds.length > 0) {
      try {
        const { data: mixProducts, error: mixError } = await supabase
          .from("project_mix_products")
          .select("item_id, item_code, short_description, description, estimated_quantity_unit_code")
          .in("project_id", projectIds)
          .limit(500);

        if (!mixError && mixProducts && mixProducts.length > 0) {
          console.log("[Products API] Found", mixProducts.length, "mix products");
          for (const p of mixProducts) {
            const code = p.item_code || String(p.item_id) || "";
            if (code && !productMap.has(code)) {
              productMap.set(code, {
                id: String(p.item_id || code),
                code: code,
                name: p.short_description || p.item_code || "",
                description: p.description || "",
                status: "Active",
                uom: p.estimated_quantity_unit_code || "CY",
              });
            }
          }
        }
      } catch (e) {
        console.log("[Products API] project_mix_products error:", e);
      }
    }

    // 2. Also try to get extra products from project_extra_products
    if (projectIds.length > 0) {
      try {
        const { data: extraProducts, error: extraError } = await supabase
          .from("project_extra_products")
          .select("item_id, item_code, short_description, description, estimated_quantity_unit_code")
          .in("project_id", projectIds)
          .limit(500);

        if (!extraError && extraProducts && extraProducts.length > 0) {
          console.log("[Products API] Found", extraProducts.length, "extra products");
          for (const p of extraProducts) {
            const code = p.item_code || String(p.item_id) || "";
            if (code && !productMap.has(code)) {
              productMap.set(code, {
                id: String(p.item_id || code),
                code: code,
                name: p.short_description || p.item_code || "",
                description: p.description || "",
                status: "Active",
                uom: p.estimated_quantity_unit_code || "EA",
              });
            }
          }
        }
      } catch (e) {
        console.log("[Products API] project_extra_products error:", e);
      }
    }

    // 3. If no products found from customer's projects, get ALL unique products from project_mix_products
    if (productMap.size === 0) {
      try {
        const { data: allMixProducts, error: allMixError } = await supabase
          .from("project_mix_products")
          .select("item_id, item_code, short_description, description, estimated_quantity_unit_code")
          .limit(500);

        if (!allMixError && allMixProducts && allMixProducts.length > 0) {
          console.log("[Products API] Found", allMixProducts.length, "all mix products");
          for (const p of allMixProducts) {
            const code = p.item_code || String(p.item_id) || "";
            if (code && !productMap.has(code)) {
              productMap.set(code, {
                id: String(p.item_id || code),
                code: code,
                name: p.short_description || p.item_code || "",
                description: p.description || "",
                status: "Active",
                uom: p.estimated_quantity_unit_code || "CY",
              });
            }
          }
        }
      } catch (e) {
        console.log("[Products API] all project_mix_products error:", e);
      }
    }

    // 4. Also try items table as fallback
    if (productMap.size === 0) {
      try {
        const { data: items, error: itemsError } = await supabase
          .from("items")
          .select("id, code, name, description, uom")
          .limit(500);

        if (!itemsError && items && items.length > 0) {
          console.log("[Products API] Found", items.length, "items");
          for (const p of items) {
            const code = p.code || String(p.id) || "";
            if (code && !productMap.has(code)) {
              productMap.set(code, {
                id: String(p.id),
                code: code,
                name: p.name || p.code || "",
                description: p.description || "",
                status: "Active",
                uom: p.uom || "EA",
              });
            }
          }
        }
      } catch (e) {
        console.log("[Products API] items table error:", e);
      }
    }

    // 5. Try mixes table as another fallback
    if (productMap.size === 0) {
      try {
        const { data: mixes, error: mixesError } = await supabase
          .from("mixes")
          .select("id, code, name, description")
          .limit(500);

        if (!mixesError && mixes && mixes.length > 0) {
          console.log("[Products API] Found", mixes.length, "mixes");
          for (const p of mixes) {
            const code = p.code || String(p.id) || "";
            if (code && !productMap.has(code)) {
              productMap.set(code, {
                id: String(p.id),
                code: code,
                name: p.name || p.code || "",
                description: p.description || "",
                status: "Active",
                uom: "CY",
              });
            }
          }
        }
      } catch (e) {
        console.log("[Products API] mixes table error:", e);
      }
    }

    const products = Array.from(productMap.values());

    // Sort by name
    products.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    console.log("[Products API] Returning", products.length, "unique products");

    return Response.json(
      { products, total: products.length },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Products API] Error:", error);
    return Response.json(
      { error: "Failed to get products", products: [] },
      { status: 500 }
    );
  }
}
