import orderRequests from "@/data/order-requests.json";

export const dynamic = "force-dynamic";

/**
 * Feed for the D3 "Order Request Dashboard" page.
 *
 * The R### order-request queue lives only in D3's authenticated D3BUY subsystem
 * (GET /dd/v1/dolese/OrderRequestDashboard_D3BUYOrderRequestDashboardV2) and is NOT
 * mirrored into our database — there is no order_requests table and no D3 scraper in
 * this repo. So this endpoint serves an EXACT snapshot extracted from the D3 export
 * (DoleseOrderRequestDashboardV2.htm → src/data/order-requests.json): 191 requests
 * coloured by status (Restarted = blue, Scheduled = green, Cancelled = red).
 *
 * NOTE: this is a static snapshot (dated ~6/25–7/28), not live data. To make it live,
 * sync the D3BUY request queue into an `order_requests` table and read that here (the
 * old orders-based approximation is still available via getOrderRequests()).
 *
 * The `region` on each row is BEST-EFFORT: the snapshot has no region field, so it was
 * derived (~39% of rows) from the customer's dominant zone county + city names in the
 * site text — the rest are unassigned and only appear under "ALL REGIONS". Exact region
 * filtering needs the per-request Region GUID from the live D3BUY feed.
 */
export async function GET(): Promise<Response> {
  return Response.json({ orders: orderRequests }, { headers: { "cache-control": "no-store" } });
}
