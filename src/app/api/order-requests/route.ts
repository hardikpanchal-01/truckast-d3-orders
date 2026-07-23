import { getOrderRequests } from "@/actions/orderActions";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * Feed for the D3 "Order Request Dashboard" page.
 *
 * The R### order-request queue lives only in D3's authenticated D3BUY subsystem
 * (GET /dd/v1/dolese/OrderRequestDashboard_D3BUYOrderRequestDashboardV2) and is NOT
 * mirrored into our database — there is no order_requests table and no D3 scraper in
 * this repo. Until that queue is synced, this endpoint serves the closest LIVE
 * approximation: getOrderRequests() derives the board from the `orders` table over a
 * rolling ±2-week window, coloured by status (in-process = "Restarted"/blue,
 * pre-pour = "Scheduled"/green, removed = "Cancelled"/red).
 *
 * Because R### requests are a distinct D3BUY entity, this is an APPROXIMATION — it will
 * not reproduce the D3BUY queue or its exact dispatch sequence 1:1. For a faithful board,
 * sync the D3BUY request queue into an `order_requests` table and read that here.
 * (The previous static snapshot lived in src/data/order-requests.json.)
 */
export async function GET(): Promise<Response> {
  // Hercules' live dashboard shows "No Requests" — it has no D3BUY queue entries. Serving
  // the orders-derived approximation here would invent a board that live doesn't show, so
  // return an empty list and let the client render D3's red "No Requests" panel. Remove
  // this branch once a real order_requests table exists to read from.
  if (await isMarketViewTenant()) {
    return Response.json({ orders: [] }, { headers: { "cache-control": "no-store" } });
  }

  const orders = await getOrderRequests();
  return Response.json({ orders }, { headers: { "cache-control": "no-store" } });
}
