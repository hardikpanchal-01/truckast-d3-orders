import { getDoleseOrderDetail } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live detail feed for the D3 "Order" page. Returns the full order detail as JSON
 * (header tiles, status, ORDERED/TICKETED/ON JOB, weather, pour-speed + trucks
 * chart series, and the activity/chat feed), regenerated from the database on
 * each call so order-live.js can render the page dynamically.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const detail = await getDoleseOrderDetail(id);
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(detail, { headers: { "cache-control": "no-store" } });
}
