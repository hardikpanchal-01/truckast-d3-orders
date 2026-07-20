import { getTenantSupabaseClient } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId]/details
 * Get project details including companies, users, and products
 */
export async function GET(request, { params }) {
  const { projectId } = await params;

  if (!projectId) {
    return Response.json(
      { success: false, error: "Project ID is required" },
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

    // Get project info
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, code, name, customer_id")
      .eq("id", projectId)
      .maybeSingle();

    if (projectError || !project) {
      console.error("[Project Details API] Project error:", projectError);
      return Response.json(
        { success: false, error: "Project not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get companies linked to this project (via project_companies or similar junction table)
    let companies = [];
    try {
      // First try to get the main customer
      const { data: mainCustomer } = await supabase
        .from("customers")
        .select("id, code, name, created_at")
        .eq("id", project.customer_id)
        .maybeSingle();

      if (mainCustomer) {
        companies.push({
          id: "main_" + String(mainCustomer.id),
          customer_id: String(mainCustomer.id),
          code: mainCustomer.code || "",
          name: mainCustomer.name || "",
          role_type: "GENERAL CONTRACTOR",
          added_date: mainCustomer.created_at || new Date().toISOString()
        });
      }

      // Try to get other linked companies from project_companies table
      const { data: projectCompanies } = await supabase
        .from("project_companies")
        .select(`
          id,
          customer_id,
          company_name,
          role,
          role_type,
          created_at,
          customers (
            id,
            code,
            name
          )
        `)
        .eq("project_id", projectId);

      if (projectCompanies) {
        for (const pc of projectCompanies) {
          const customerId = pc.customer_id || (pc.customers ? pc.customers.id : null);
          const existingIndex = companies.findIndex(c => c.customer_id === String(customerId));

          // If this is the main customer, update the existing entry with project_company id
          if (existingIndex >= 0) {
            companies[existingIndex].id = String(pc.id);
            companies[existingIndex].role_type = pc.role_type || pc.role || companies[existingIndex].role_type;
          } else {
            companies.push({
              id: String(pc.id),
              customer_id: String(customerId),
              code: pc.customers?.code || "",
              name: pc.company_name || pc.customers?.name || "",
              role_type: pc.role_type || pc.role || "GENERAL CONTRACTOR",
              added_date: pc.created_at
            });
          }
        }
      }
    } catch (e) {
      console.log("[Project Details API] Could not get companies:", e.message);
    }

    // Get users assigned to this project
    let users = [];
    try {
      // Get user_projects entries with customer_id
      const { data: projectUserLinks, error: userLinksError } = await supabase
        .from("user_projects")
        .select("user_id, customer_id")
        .eq("project_id", projectId);

      if (userLinksError) {
        console.log("[Project Details API] user_projects query error:", userLinksError.message);
      }

      if (projectUserLinks && projectUserLinks.length > 0) {
        const userIds = projectUserLinks.map(pu => pu.user_id);

        // Create a map of user_id to customer_id from user_projects
        const userCustomerMap = {};
        projectUserLinks.forEach(pu => {
          userCustomerMap[String(pu.user_id)] = pu.customer_id;
        });

        // Get user details
        const { data: userDetails, error: usersError } = await supabase
          .from("users")
          .select("id, name, email")
          .in("id", userIds);

        if (usersError) {
          console.log("[Project Details API] users query error:", usersError.message);
        }

        if (userDetails) {
          // Get customer names using customer_ids from user_projects
          const customerIds = [...new Set(projectUserLinks.filter(pu => pu.customer_id).map(pu => pu.customer_id))];
          let customerMap = {};

          if (customerIds.length > 0) {
            const { data: customers } = await supabase
              .from("customers")
              .select("id, name")
              .in("id", customerIds);

            if (customers) {
              customers.forEach(c => {
                customerMap[String(c.id)] = c.name;
              });
            }
          }

          users = userDetails.map(user => {
            const customerId = userCustomerMap[String(user.id)];
            return {
              id: String(user.id),
              name: user.name || user.email || "Unknown User",
              email: user.email || "",
              company_name: customerId ? (customerMap[String(customerId)] || "") : ""
            };
          });
        }
      }
    } catch (e) {
      console.log("[Project Details API] Could not get users:", e.message);
    }

    // Get products for this project from multiple tables
    let products = [];
    try {
      // Get mix products (concrete) - these are green tiles
      const { data: mixProducts } = await supabase
        .from("project_mix_products")
        .select(`
          id,
          item_code,
          short_description,
          description,
          estimated_quantity,
          estimated_quantity_unit
        `)
        .eq("project_id", projectId);

      if (mixProducts) {
        mixProducts.forEach(mp => {
          products.push({
            id: "mix_" + String(mp.id),
            code: mp.item_code || "",
            name: mp.short_description || mp.description || "",
            quantity: mp.estimated_quantity || 0,
            unit: mp.estimated_quantity_unit || "CY",
            is_concrete: true
          });
        });
      }

      // Get extra products (non-concrete standalone items) - these are blue tiles
      const { data: extraProducts } = await supabase
        .from("project_extra_products")
        .select(`
          id,
          item_code,
          short_description,
          description,
          estimated_quantity,
          estimated_quantity_unit
        `)
        .eq("project_id", projectId);

      if (extraProducts) {
        extraProducts.forEach(ep => {
          products.push({
            id: "extra_" + String(ep.id),
            code: ep.item_code || "",
            name: ep.short_description || ep.description || "",
            quantity: ep.estimated_quantity || 0,
            unit: ep.estimated_quantity_unit || "EA",
            is_concrete: false
          });
        });
      }

      // Get associated products linked to mix products - these are also blue tiles
      if (mixProducts && mixProducts.length > 0) {
        const mixProductIds = mixProducts.map(mp => mp.id);
        const { data: assocProducts } = await supabase
          .from("project_assoc_products")
          .select(`
            id,
            item_code,
            short_description,
            description,
            estimated_quantity,
            estimated_quantity_unit
          `)
          .in("mix_product_id", mixProductIds);

        if (assocProducts) {
          assocProducts.forEach(ap => {
            products.push({
              id: "assoc_" + String(ap.id),
              code: ap.item_code || "",
              name: ap.short_description || ap.description || "",
              quantity: ap.estimated_quantity || 0,
              unit: ap.estimated_quantity_unit || "EA",
              is_concrete: false
            });
          });
        }
      }
    } catch (e) {
      console.log("[Project Details API] Could not get products:", e.message);
    }

    return Response.json(
      {
        success: true,
        project: {
          id: String(project.id),
          code: project.code || "",
          name: project.name || "",
          customer_id: project.customer_id ? String(project.customer_id) : ""
        },
        companies,
        users,
        products
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] GET /api/projects/[projectId]/details:", error);
    return Response.json(
      { success: false, error: "Failed to get project details" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
