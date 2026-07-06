import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Dolese Market Summary — serves the exact D3 "MarketSummary" HTML export
 * (public/d3-static/market.html + its real MarketSummary_files assets) directly as
 * the "/" response, no app chrome (the export carries its own TRUCKAST nav). The
 * shell is self-dynamic: market-live.js renders the DOLESE business-unit summary
 * tile (pie + used-of-total CY + order counts) from /api/market-summary and wires
 * the date dropdown. The server only absolutizes the relative asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "market.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./MarketSummary_files/").join("/d3-static/MarketSummary_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
