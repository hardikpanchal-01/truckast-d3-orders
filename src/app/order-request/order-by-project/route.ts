import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Order By Project — serves the exact D3 "OrderRequest/OrderByProject" HTML export
 * (public/d3-static/order-by-project.html + its OrderByProject_files assets) directly,
 * no app chrome. The shell is self-dynamic: order-by-project-live.js wires the SEARCH
 * button to /api/customer-search and renders one customer tile per match. The server
 * only absolutizes the relative asset paths so the CSS/JS/images resolve at
 * /order-request/order-by-project.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-by-project.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./OrderByProject_files/").join("/d3-static/OrderByProject_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
