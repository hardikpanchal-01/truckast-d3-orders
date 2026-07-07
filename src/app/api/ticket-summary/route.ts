import { getDoleseTicketSummary } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 Ticket Summary page: one load per delivered ticket for the
 * order (LOAD #, truck + plant, ticket CY, cumulative-of-total), regenerated from the
 * database on each call so ticket-summary.html can render its load tiles.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });

  const summary = await getDoleseTicketSummary(Number(id));
  if (!summary) return Response.json({ error: "not found" }, { status: 404 });

  return Response.json(summary, { headers: { "cache-control": "no-store" } });
}
