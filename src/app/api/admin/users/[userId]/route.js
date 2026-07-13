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
      return Response.json(
        { success: false, error: "User not found" },
        { status: 404, headers: { "cache-control": "no-store" } }
      );
    }

    return Response.json(
      { success: true, data: user },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/[userId]:", error);
    return Response.json(
      { success: false, error: "Failed to get user details" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
