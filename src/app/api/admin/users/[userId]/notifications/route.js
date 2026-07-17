import { getUserNotifications } from "@/actions/adminActions";

export const dynamic = "force-dynamic";

/**
 * API endpoint for getting user notifications.
 * Used by the static HTML page at /d3-static/user-notifications.html
 */
export async function GET(request, { params }) {
  const { userId } = await params;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!userId) {
    return Response.json(
      { success: false, error: "User ID is required" },
      { status: 400, headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const notifications = await getUserNotifications(userId, startDate, endDate);

    return Response.json(
      { success: true, data: notifications },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/[userId]/notifications:", error);
    return Response.json(
      { success: false, error: "Failed to fetch notifications" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
