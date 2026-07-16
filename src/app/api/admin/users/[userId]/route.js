import { getAdminUserDetails } from "@/actions/adminActions";

export const dynamic = "force-dynamic";

/**
 * API endpoint for getting admin user details by ID.
 * Used by the static HTML page at /d3-static/user-details.html
 */
export async function GET(request, { params }) {
  const { userId } = await params;

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const user = await getAdminUserDetails(userId);

    if (!user) {
      // Return partial data so the page can still function
      return Response.json(
        {
          success: true,
          data: {
            id: userId,
            first_name: "",
            last_name: "",
            name: "User",
            email: "",
            phone: "",
            title: "",
            customer_id: null,
            customer_name: null,
            tenant_name: "DOLESE",
            status: "unknown",
            status_label: "",
            status_date: null,
            forced_logout: false,
            has_order_access: false
          },
          warning: "User details could not be loaded"
        },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return Response.json(
      { success: true, data: user },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/[userId]:", error);
    // Return partial data so the page can still function
    return Response.json(
      {
        success: true,
        data: {
          id: userId,
          first_name: "",
          last_name: "",
          name: "User",
          email: "",
          phone: "",
          title: "",
          customer_id: null,
          customer_name: null,
          tenant_name: "DOLESE",
          status: "unknown",
          status_label: "",
          status_date: null,
          forced_logout: false,
          has_order_access: false
        },
        warning: "Error loading user: " + (error.message || "Unknown error")
      },
      { headers: { "cache-control": "no-store" } }
    );
  }
}
