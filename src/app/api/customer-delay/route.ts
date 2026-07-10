import { getDoleseCustomerDelay } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 "<CUSTOMER> - DELAY MINUTES" page (AggCustomerDelay). Returns the
 * per-load customer-delay breakdown as JSON (title/order/address + one entry per delayed
 * load with PLAN / DELAY / ACTUAL minutes), regenerated from the database on each call so
 * agg-customer-delay-live.js can render the tiles dynamically.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const data = await getDoleseCustomerDelay(Number(id));
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
