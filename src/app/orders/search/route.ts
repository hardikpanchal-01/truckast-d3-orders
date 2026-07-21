import { buildOrderSearchHtml } from "@/lib/d3-orders-html";

export const dynamic = "force-dynamic";

/**
 * D3 "OrderSearch" form — reached from the Dolese Orders date dropdown's SEARCH option.
 * Returns the static D3 shell (public/d3-static/order-search.html) with its asset paths
 * absolutized. The date pickers + SEARCH button are wired client-side by
 * order-search-live.js, which navigates back to /orders?date=&dateTo= on submit.
 */
export async function GET(): Promise<Response> {
  const html = await buildOrderSearchHtml();
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
