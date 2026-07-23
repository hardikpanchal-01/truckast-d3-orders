import { readFile } from "fs/promises";
import { join } from "path";
import { applyTenantToUrl } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

/**
 * Order Details — serves the D3 "OrderDetails" HTML shell directly, no app chrome.
 * The shell (order-details.html) is self-dynamic: order-details-live.js reads the order
 * id from the URL and renders the header tiles / product cards / weather LIVE from
 * /api/order-detail. (The raw D3 Order.htm export can't be used directly — its data is
 * baked in and its scripts require D3's own backend — so we keep this live shell and add
 * the D3 tiles to it instead.) The server only absolutizes the shared Order_files paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-details.html");

export async function GET(request: Request): Promise<Response> {
  const redirect = await applyTenantToUrl(request);
  if (redirect) return redirect;

  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
