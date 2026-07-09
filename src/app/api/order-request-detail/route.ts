import orderRequests from "@/data/order-requests.json";

export const dynamic = "force-dynamic";

/**
 * Per-request feed for the Order Request Details page. Looks the request up by its
 * OrderRequestID (GUID) or R-code in the same static snapshot the dashboard uses
 * (src/data/order-requests.json). The snapshot carries only the dashboard-level fields
 * (code, start, CY, address, customer, status, region) — the rich detail D3 shows
 * (product mixes, spacing, chute usage, jobsite contact, notes, chat) lives only in
 * D3's D3BUY subsystem and would require an `order_requests` sync to populate here.
 */
type Req = {
  order_id: string | number;
  order_code: string;
  start_time: string | null;
  ordered_cy: number;
  address: string | null;
  customer_name: string | null;
  status: string;
  region: string | null;
};

export async function GET(req: Request): Promise<Response> {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const list = orderRequests as Req[];
  const key = id.toUpperCase();
  const match = list.find(
    (o) => String(o.order_id).toUpperCase() === key || String(o.order_code).toUpperCase() === key,
  );
  if (!match) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(match, { headers: { "cache-control": "no-store" } });
}
