import { searchOrderProjects } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Search feed for the D3 "Order By Project" page (order-by-project-live.js).
 *
 * Mirrors D3's OrderByProject result set: for each matched customer the page shows
 * a blue "NEW ORDER W/O PROJECT" tile, plus one green tile per existing project
 * (project name, "Recent Orders N", "Project <code> Customer <code>").
 *
 * searchOrderProjects() resolves both halves from our mirror: matched `customers`
 * (from the customers table) and their `projects` (from the projects table, with
 * recent_orders counted live from the orders table).
 */
export async function GET(request: Request): Promise<Response> {
  // A blank q is a valid "show everything" request (mirrors D3's wildcard SEARCH) —
  // searchOrderProjects("") returns the full customer + project book.
  const q = new URL(request.url).searchParams.get("q") || "";
  const result = await searchOrderProjects(q);
  return Response.json(result, { headers: { "cache-control": "no-store" } });
}
