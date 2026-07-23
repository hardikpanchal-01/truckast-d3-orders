import { readFile } from "fs/promises";
import { join } from "path";
import { isMarketViewTenant, applyHerculesNav } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * Order Request Dashboard — serves the exact D3 "DoleseOrderRequestDashboardV2" HTML
 * export (public/d3-static/order-request.html + its real JobsForFixedNodeID_files
 * assets) directly, no app chrome. The shell is self-dynamic: order-request-live.js
 * renders one request tile per order from /api/order-requests, coloured by status
 * (Restarted = blue, Scheduled = green, Cancelled = red). The server only absolutizes
 * the relative asset paths so the CSS/JS/images resolve at /order-request.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-request.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./JobsForFixedNodeID_files/").join("/d3-static/JobsForFixedNodeID_files/");

  if (await isMarketViewTenant()) html = applyHerculesNav(html);
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
