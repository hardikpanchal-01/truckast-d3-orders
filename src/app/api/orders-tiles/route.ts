import { getDoleseOrders, getActiveAnnouncement } from "@/actions/orderActions";
import { renderTiles } from "@/lib/d3-orders-html";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * Live tile feed for the D3 orders page. Returns the order-tiles markup
 * (fuel promo + one tile per order) as an HTML fragment, regenerated from the
 * database on each call, so the page can fetch + swap it in dynamically.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.get("date") || today;
  const dateToStr = searchParams.get("dateTo") || undefined; // range end (Last 7 / month / Future / …)
  const plant = searchParams.get("plant") || undefined; // plant/market code (D3 dropdown); empty = all

  // Merged: upstream's `plant` filter passed to getDoleseOrders PLUS our Hercules
  // amber ON HOLD tiles (holdYellow when the tenant is on the MARKETS view).
  const [orders, announcement, marketView] = await Promise.all([
    getDoleseOrders(dateStr, dateToStr, plant),
    getActiveAnnouncement(),
    isMarketViewTenant(),
  ]);
  const html = renderTiles(orders, announcement, { holdYellow: marketView });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
