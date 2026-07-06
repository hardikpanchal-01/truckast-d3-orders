import { getDoleseSummary } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 Market Summary landing page: the DOLESE business-unit
 * roll-up (used-of-total CY + order counts) for the selected date, regenerated
 * from the database on each call so market.html can render its summary tile.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.get("date") || today;
  const dateToStr = searchParams.get("dateTo") || undefined; // optional range end

  const summary = await getDoleseSummary(dateStr, dateToStr);
  // Round CY to the nearest 0.50 (concrete is half-yard increments) to match D3.
  const round2 = (n: number) => Math.round(n * 2) / 2;

  return Response.json(
    {
      name: summary.name,
      usedCY: round2(summary.usedCY),
      totalCY: round2(summary.totalCY),
      totalOrders: summary.totalOrders,
      activeOrders: summary.activeOrders,
      cancelledOrders: summary.cancelledOrders,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
