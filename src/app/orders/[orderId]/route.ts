import { readFile } from "fs/promises";
import { join } from "path";
import { applyTenantToUrl } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

/**
 * Dolese order detail — serves the exact D3 "Order" HTML export
 * (public/d3-static/order.html + its real Order_files assets) directly, no app
 * chrome (the export carries its own TRUCKAST nav). The shell is self-dynamic:
 * order-live.js reads the order id from the URL and renders the tiles, status,
 * weather, the two Highcharts and the chat feed from /api/order-detail. The
 * server only absolutizes the relative asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order.html");

export async function GET(request: Request): Promise<Response> {
  const redirect = await applyTenantToUrl(request);
  if (redirect) return redirect;

  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
