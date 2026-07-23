import { readFile } from "fs/promises";
import { join } from "path";
import { redirect } from "next/navigation";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

/**
 * D3 "Mobile Tickets — view by order" page. Reached from the MOBILE TICKET tile on the
 * Hercules JOBS board. Hercules-only: any other tenant is sent back to the orders board,
 * so no existing tenant gains a page it doesn't have on D3.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "mobile-tickets.html");

export async function GET(): Promise<Response> {
  if (!(await isMarketViewTenant())) redirect("/orders");

  const html = await readFile(TEMPLATE_PATH, "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
