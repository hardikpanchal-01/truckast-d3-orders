import { buildOrdersHtml } from "@/lib/d3-orders-html";

export const dynamic = "force-dynamic";

/**
 * Dolese orders — returns the exact D3 "JobsForFixedNodeID" HTML document
 * directly as the /orders response (no iframe, no app chrome). The shell is the
 * real D3 export (public/d3-static, real d3_complete.css + assets) and is now
 * self-dynamic: it renders the order tiles from /api/orders-tiles and the plant
 * total / date from /api/orders-summary on the client (nothing baked in). The
 * server only absolutizes the asset paths for this route.
 */
export async function GET(): Promise<Response> {
  const html = await buildOrdersHtml();

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
