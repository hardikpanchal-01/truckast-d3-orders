import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Order Details — serves the D3 "OrderDetails" HTML shell
 * (public/d3-static/order-details.html) directly, no app chrome. The shell is
 * self-dynamic: order-details-live.js reads the order id from the URL
 * (/orders/{id}/details) and renders the STATUS/ON JOB/RATE header tiles, the product
 * cards and the weather tile from /api/order-detail. The server only absolutizes the
 * shared Order_files asset paths. The ORDERED tile on the order page links here.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-details.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
