import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Delay Details — serves the D3 "TicketStatusDetails" HTML shell
 * (public/d3-static/ticket-status-details.html) directly, no app chrome. The shell is
 * self-dynamic: ticket-status-details-live.js reads the order id from the URL
 * (/orders/{id}/delays) and renders the full per-load delay table from
 * /api/order-detail (delay_loads). The server only absolutizes the shared asset paths
 * (the page reuses the Order export's Order_files assets).
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "ticket-status-details.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
