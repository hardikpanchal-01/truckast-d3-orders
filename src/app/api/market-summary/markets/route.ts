import { getMarketSummaryRows } from "@/actions/marketActions";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * Live feed for the D3 "MARKETS" landing page (Hercules): the company roll-up tile
 * followed by one tile per plant, for the selected date. Sibling of
 * /api/market-summary, which keeps serving the single business-unit tile for every
 * other tenant and is not modified.
 *
 * CY is rounded to 2dp here, NOT to the nearest 0.50 like /api/market-summary — the
 * live D3 market tiles show values such as 5,790.59 and 1,078.51.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.get("date") || today;
  const dateToStr = searchParams.get("dateTo") || undefined; // optional range end

  // Tenants without the MARKETS view get an empty list rather than a 404, so a stale
  // client that asks for markets simply renders nothing instead of erroring.
  if (!(await isMarketViewTenant())) {
    return Response.json({ markets: [] }, { headers: { "cache-control": "no-store" } });
  }

  const markets = await getMarketSummaryRows(dateStr, dateToStr);

  return Response.json({ markets }, { headers: { "cache-control": "no-store" } });
}
