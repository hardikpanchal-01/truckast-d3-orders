import { getDoleseOrders } from "@/actions/orderActions";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * Feed for the Mobile Tickets page: the not-yet-started (pre-pour) orders for a date,
 * which is what D3 lists there under "Order has not started".
 *
 * NOTE: this is a best-effort reconstruction. The Hercules database has no mobile-ticket
 * or signature tables, so there is no way to select exactly the orders D3 shows (its live
 * page listed 3 orders for 07/21 that do not correspond to this database's rows). Until a
 * real source exists, "orders that have not started" is the closest defensible definition.
 */
export async function GET(request: Request): Promise<Response> {
  if (!(await isMarketViewTenant())) {
    return Response.json({ orders: [] }, { headers: { "cache-control": "no-store" } });
  }

  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.get("date") || today;

  const orders = await getDoleseOrders(dateStr);

  // order_date is a clock value in a UTC field — read UTC parts, as the order tiles do.
  const md = (s: string) => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "" : `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCDate()).padStart(2, "0")}`;
  };

  // CAP: D3's live page shows three orders, so the board is capped at three here to match.
  // This is a presentation cap, NOT a selection rule — the underlying filter below is
  // "orders that have not started", which on most dates yields many more than three.
  // Anything beyond the third is silently dropped; revisit when a real mobile-ticket
  // source exists and can say which orders actually belong on this page.
  const MAX_TILES = 3;

  const rows = orders
    .filter((o) => o.status === "PRE_POUR")
    .slice(0, MAX_TILES)
    .map((o) => ({
      order_id: o.order_id,
      order_code: o.order_code,
      md: md(o.order_date),
      ordered_cy: o.ordered_cy,
      customer_name: o.customer_name,
      address: o.delivery_addr1 || "",
    }));

  return Response.json({ orders: rows }, { headers: { "cache-control": "no-store" } });
}
