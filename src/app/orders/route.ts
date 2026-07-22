import { buildOrdersHtml } from "@/lib/d3-orders-html";
import { applyTenantToUrl } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

/**
 * Orders board ("JobsForFixedNodeID") — returns the D3 HTML document directly as the
 * /orders response, self-dynamic from /api/orders-tiles + /api/orders-summary. The URL
 * carries ?tenant=<x> (like D3's /dv/v1/<tenant>/…) so you can see which tenant's data
 * this is; that param is authoritative and drives the tenant.
 */
export async function GET(request: Request): Promise<Response> {
  const redirect = await applyTenantToUrl(request);
  if (redirect) return redirect;

  const html = await buildOrdersHtml();

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
