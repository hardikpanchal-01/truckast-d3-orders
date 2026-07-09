import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Order Request Details — serves the D3 "DoleseOrderRequestDetailsV2" HTML shell
 * (public/d3-static/order-request-details.html). The shell is self-dynamic:
 * order-request-details-live.js reads the OrderRequestID (GUID) from /order-request/{id},
 * fetches /api/order-request-detail and fills the title / verify form / tile group /
 * product tile / tables / chat. Reached by clicking a tile on the Order Request Dashboard.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-request-details.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./JobsForFixedNodeID_files/").join("/d3-static/JobsForFixedNodeID_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
