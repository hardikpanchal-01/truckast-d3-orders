import { searchAdminUsers } from "@/actions/adminActions";

export const dynamic = "force-dynamic";

/**
 * API endpoint for admin user search.
 * Used by the static HTML page at /d3-static/user-search.html
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  if (!q.trim()) {
    return Response.json(
      { success: true, data: [] },
      { headers: { "cache-control": "no-store" } }
    );
  }

  try {
    const users = await searchAdminUsers(q);
    return Response.json(
      { success: true, data: users },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/users/search:", error);
    return Response.json(
      { success: false, error: "Failed to search users" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
