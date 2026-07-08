import { getDoleseOrders, getActiveAnnouncement } from "@/actions/orderActions";
import { renderTiles } from "@/lib/d3-orders-html";

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

  const [orders, announcement] = await Promise.all([getDoleseOrders(dateStr), getActiveAnnouncement()]);
  const html = renderTiles(orders, announcement);

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
