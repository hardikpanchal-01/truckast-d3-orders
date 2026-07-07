import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Ticket Summary (loads list) — serves the exact D3 "TicketSummary" HTML export
 * (public/d3-static/ticket-summary.html + its real TicketSummary_files assets)
 * directly, no app chrome. The shell is self-dynamic: ticket-summary-live.js reads
 * the order id from the URL (/orders/{id}/tickets), renders the header/status and one
 * load tile per ticket from /api/ticket-summary, and each tile links to the ticket
 * detail. The server only absolutizes the relative asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "ticket-summary.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./TicketSummary_files/").join("/d3-static/TicketSummary_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
