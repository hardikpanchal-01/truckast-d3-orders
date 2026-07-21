import { readFile } from "fs/promises";
import { join } from "path";
import { getTenantBoardTitle, getSelectedTenant } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * Market Summary — serves the D3 "MarketSummary" HTML shell with tenant-specific
 * templates. For Concrete Supply, serves a dedicated template that exactly matches
 * D3's layout (ORDER CONCRETE + MOBILE TICKET tiles, Fuel Surcharges + Summary).
 * For other tenants, serves the default Dolese-style template.
 */
const DEFAULT_TEMPLATE = join(process.cwd(), "public", "d3-static", "market.html");
const CONCRETE_SUPPLY_TEMPLATE = join(process.cwd(), "public", "d3-static", "market-concretesupply.html");

export async function GET(): Promise<Response> {
  // Check if tenant is Concrete Supply
  const selectedTenant = await getSelectedTenant();
  const isConcreteSupply = selectedTenant?.toLowerCase().includes("concrete");

  let html: string;

  if (isConcreteSupply) {
    // Serve the Concrete Supply template (D3 exact match)
    html = await readFile(CONCRETE_SUPPLY_TEMPLATE, "utf8");
    html = html.split("./MarketSummary_files/").join("/d3-static/MarketSummary_files/");
  } else {
    // Serve the default template with tenant-specific title
    html = await readFile(DEFAULT_TEMPLATE, "utf8");
    html = html.split("./MarketSummary_files/").join("/d3-static/MarketSummary_files/");
    const title = await getTenantBoardTitle();
    html = html.replace(/<strong>\s*Dolese\s+Orders\s*<\/strong>/g, `<strong>${title}</strong>`);
  }

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
