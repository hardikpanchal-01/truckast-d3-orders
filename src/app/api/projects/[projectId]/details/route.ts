import { getTenantSupabaseClient } from "@/actions/tenantActions";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId]/details
 * Get full project details including companies, users, and products
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> }
): Promise<Response> {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return Response.json(
        { error: "Project ID is required" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = await getTenantSupabaseClient();

    if (!supabase) {
      console.error("[Project Details API] No tenant database connection");
      return Response.json(
        { error: "No database connection" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    // Get project info with all relevant fields from schema
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select(`
        id, code, name, customer_id, customer_code, customer_name,
        setup_date, expiration_date,
        delivery_addr1, delivery_addr2, delivery_addr3,
        instruction1, instruction2, instruction3,
        contact, phone, fax, cellular, email,
        invoice_name, invoice_addr1, invoice_addr2, invoice_city, invoice_state, invoice_postal_code,
        salesman_code, salesman_name,
        zone_code, tax_code, taxable,
        restrict_orders_to_project_products,
        latitude, longitude,
        project_type, stage
      `)
      .eq("id", projectId)
      .single();

    if (projectError || !project) {
      console.error("[Project Details API] Project not found:", projectError);
      return Response.json(
        { error: "Project not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    // Get companies associated with the project
    // Companies are linked via customer_id - get the main customer and any sub-companies
    const companies: Array<{
      id: string;
      customer_id: string;
      name: string;
      role: string;
      added_date: string;
    }> = [];

    // Add the main customer as a company
    if (project.customer_id) {
      const { data: customer } = await supabase
        .from("customers")
        .select("id, code, name, created_at")
        .eq("id", project.customer_id)
        .single();

      if (customer) {
        companies.push({
          id: String(customer.id),
          customer_id: String(customer.id),
          name: customer.name || customer.code || "Unknown",
          role: "GENERAL CONTRACTOR",
          added_date: customer.created_at
            ? new Date(customer.created_at).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })
            : project.setup_date
            ? new Date(project.setup_date).toLocaleDateString("en-US", {
                month: "2-digit",
                day: "2-digit",
                year: "numeric",
              })
            : "",
        });
      }
    }

    // Get users assigned to this project (with customer_id from user_projects)
    const { data: userProjects, error: usersError } = await supabase
      .from("user_projects")
      .select("user_id, customer_id, created_at")
      .eq("project_id", projectId);

    const users: Array<{
      id: string;
      first_name: string;
      last_name: string;
      company_name: string;
      added_date: string;
    }> = [];

    if (!usersError && userProjects && userProjects.length > 0) {
      const userIds = userProjects.map((up) => up.user_id);

      // Create a map of user_id to customer_id from user_projects
      const userCustomerMap: Record<string, { customer_id: string; created_at: string }> = {};
      userProjects.forEach((up) => {
        userCustomerMap[String(up.user_id)] = {
          customer_id: String(up.customer_id),
          created_at: up.created_at || "",
        };
      });

      const { data: usersData } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .in("id", userIds);

      if (usersData) {
        // Get unique customer IDs from user_projects
        const customerIds = [...new Set(userProjects.map((up) => up.customer_id).filter(Boolean))];
        let customerNames: Record<string, string> = {};

        if (customerIds.length > 0) {
          const { data: customers } = await supabase
            .from("customers")
            .select("id, name")
            .in("id", customerIds);

          if (customers) {
            customers.forEach((c) => {
              customerNames[String(c.id)] = c.name || "";
            });
          }
        }

        usersData.forEach((user) => {
          const userInfo = userCustomerMap[String(user.id)] || { customer_id: "", created_at: "" };
          users.push({
            id: String(user.id),
            first_name: user.first_name || "",
            last_name: user.last_name || "",
            company_name: customerNames[userInfo.customer_id] || "",
            added_date: userInfo.created_at
              ? new Date(userInfo.created_at).toLocaleDateString("en-US", {
                  month: "2-digit",
                  day: "2-digit",
                  year: "numeric",
                })
              : "",
          });
        });
      }
    }

    // Get products from all three product tables
    const products: Array<{
      id: string;
      code: string;
      name: string;
      description: string;
      quantity: string;
      unit: string;
      is_concrete: boolean;
      product_type: string;
    }> = [];

    // 1. Get mix products (concrete mixes)
    const { data: mixProducts } = await supabase
      .from("project_mix_products")
      .select(
        "id, item_id, item_code, short_description, description, estimated_quantity, estimated_quantity_unit_code"
      )
      .eq("project_id", projectId)
      .order("item_code", { ascending: true });

    if (mixProducts) {
      mixProducts.forEach((p) => {
        const code = p.item_code || String(p.item_id) || "";
        const desc = p.short_description || p.description || "";
        const unit = p.estimated_quantity_unit_code || "CY";
        const qty = p.estimated_quantity || 0;

        products.push({
          id: String(p.id),
          code: code,
          name: desc,
          description: desc,
          quantity: typeof qty === "number" ? qty.toFixed(2) : "0.00",
          unit: unit,
          is_concrete: true, // Mix products are concrete
          product_type: "mix",
        });
      });
    }

    // 2. Get extra products (add-ons, charges, etc.)
    const { data: extraProducts } = await supabase
      .from("project_extra_products")
      .select(
        "id, item_id, item_code, short_description, description, estimated_quantity, estimated_quantity_unit_code"
      )
      .eq("project_id", projectId)
      .order("item_code", { ascending: true });

    if (extraProducts) {
      extraProducts.forEach((p) => {
        const code = p.item_code || String(p.item_id) || "";
        const desc = p.short_description || p.description || "";
        const unit = p.estimated_quantity_unit_code || "EA";
        const qty = p.estimated_quantity || 0;

        products.push({
          id: String(p.id),
          code: code,
          name: desc,
          description: desc,
          quantity: typeof qty === "number" ? qty.toFixed(2) : "0.00",
          unit: unit,
          is_concrete: false, // Extra products are not concrete
          product_type: "extra",
        });
      });
    }

    // 3. Get associated products (linked to mix products)
    // First get all mix product IDs for this project
    const mixProductIds = mixProducts?.map((p) => p.id) || [];

    if (mixProductIds.length > 0) {
      const { data: assocProducts } = await supabase
        .from("project_assoc_products")
        .select(
          "id, item_id, item_code, short_description, description, estimated_quantity, estimated_quantity_unit_code"
        )
        .in("mix_product_id", mixProductIds)
        .order("item_code", { ascending: true });

      if (assocProducts) {
        assocProducts.forEach((p) => {
          const code = p.item_code || String(p.item_id) || "";
          const desc = p.short_description || p.description || "";
          const unit = p.estimated_quantity_unit_code || "EA";
          const qty = p.estimated_quantity || 0;

          products.push({
            id: String(p.id),
            code: code,
            name: desc,
            description: desc,
            quantity: typeof qty === "number" ? qty.toFixed(2) : "0.00",
            unit: unit,
            is_concrete: false, // Associated products are not concrete
            product_type: "assoc",
          });
        });
      }
    }

    // Build address from delivery fields
    const deliveryAddress = [
      project.delivery_addr1,
      project.delivery_addr2,
      project.delivery_addr3,
    ]
      .filter(Boolean)
      .join(", ");

    return Response.json(
      {
        success: true,
        data: {
          project_id: String(project.id),
          project_name: project.name,
          project_code: project.code,
          customer_id: String(project.customer_id),
          customer_code: project.customer_code,
          customer_name: project.customer_name,
          setup_date: project.setup_date,
          expiration_date: project.expiration_date,
          delivery_address: deliveryAddress,
          delivery_addr1: project.delivery_addr1,
          delivery_addr2: project.delivery_addr2,
          delivery_addr3: project.delivery_addr3,
          instructions: [project.instruction1, project.instruction2, project.instruction3]
            .filter(Boolean)
            .join("\n"),
          contact: project.contact,
          phone: project.phone,
          email: project.email,
          salesman_name: project.salesman_name,
          zone_code: project.zone_code,
          tax_code: project.tax_code,
          taxable: project.taxable,
          restrict_products: project.restrict_orders_to_project_products,
          latitude: project.latitude,
          longitude: project.longitude,
          project_type: project.project_type,
          stage: project.stage,
          companies: companies,
          users: users,
          products: products,
        },
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[Project Details API] Error:", error);
    return Response.json(
      { error: "Failed to get project details" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
