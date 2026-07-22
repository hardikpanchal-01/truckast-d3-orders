import { getMarketByPlant } from "@/actions/orderActions";

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

  const summary = await getMarketByPlant(dateStr, dateToStr);
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
      // Whether the MARKET page renders the per-plant tiles (Sunrise yes, Dolese no).
      // The board plant dropdown uses `plants` regardless.
      showPlants: summary.showPlants,
      // Per-plant market cards (D3's "1 - NEW FAIRVIEW", "2 - PONDER", …), code-sorted.
      plants: summary.plants.map((p) => ({
        code: p.code,
        name: p.name,
        usedCY: round2(p.usedCY),
        totalCY: round2(p.totalCY),
        totalOrders: p.totalOrders,
        activeOrders: p.activeOrders,
        cancelledOrders: p.cancelledOrders,
      })),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
