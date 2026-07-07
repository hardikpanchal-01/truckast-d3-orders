import { getDoleseTicketDetail } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 Ticket Details page: the truck/plant header, ordered products
 * and the status-timeline + Verifi sensor cards for one ticket, regenerated from the
 * database on each call so ticket-details.html can render its tiles.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const detail = await getDoleseTicketDetail(Number(id));
  if (!detail) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(detail, { headers: { "cache-control": "no-store" } });
}
