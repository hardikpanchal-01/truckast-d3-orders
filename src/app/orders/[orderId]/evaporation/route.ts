import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Evaporation Details — serves the D3 "evaporationdetails" HTML shell
 * (public/d3-static/evaporation-details.html). The shell is self-dynamic:
 * evaporation-details-live.js reads the order id from /orders/{id}/evaporation and fills
 * the Status / rate / concrete-temp / order / ticket rows from /api/order-detail. The
 * green Evaporation tile on the order page links here.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "evaporation-details.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
