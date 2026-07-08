import { getDoleseTruckArrival } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 "Truck Arrival" page — the trucks currently heading to / on the
 * job for an order. truck-arrival-live.js renders one tile per active truck.
 */
export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const data = await getDoleseTruckArrival(Number(id));
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
