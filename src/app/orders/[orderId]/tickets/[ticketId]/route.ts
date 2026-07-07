import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Ticket Details — serves the exact D3 "TicketDetails" HTML export
 * (public/d3-static/ticket-details.html + its real TicketDetails_files assets)
 * directly. The shell is self-dynamic: ticket-details-live.js reads the ticket id
 * from the URL (/orders/{orderId}/tickets/{ticketId}) and renders the truck tile,
 * ordered products and the status-timeline + Verifi cards from /api/ticket-detail.
 * The server only absolutizes the relative asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "ticket-details.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./TicketDetails_files/").join("/d3-static/TicketDetails_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
