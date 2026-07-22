import { readFile } from "fs/promises";
import { join } from "path";
import { getSelectedTenant } from "@/actions/tenantActions";
import { applyTenantToUrl } from "@/lib/tenant-url";

export const dynamic = "force-dynamic";

/**
 * Market Summary — serves the D3 "MarketSummary" HTML shell with tenant-specific
 * templates. For Concrete Supply, serves a dedicated template that exactly matches
 * D3's layout (ORDER CONCRETE + MOBILE TICKET tiles, Fuel Surcharges + Summary).
 * For other tenants, serves the default Dolese-style template.
 */
const DEFAULT_TEMPLATE = join(process.cwd(), "public", "d3-static", "market.html");
const CONCRETE_SUPPLY_TEMPLATE = join(process.cwd(), "public", "d3-static", "market-concretesupply.html");

export async function GET(request: Request): Promise<Response> {
  const redirect = await applyTenantToUrl(request);
  if (redirect) return redirect;

  // Check if tenant is Concrete Supply
  const selectedTenant = await getSelectedTenant();
  const isConcreteSupply = selectedTenant?.toLowerCase().includes("concrete");

  let html: string;

  if (isConcreteSupply) {
    // Serve the Concrete Supply template (D3 exact match)
    html = await readFile(CONCRETE_SUPPLY_TEMPLATE, "utf8");
    html = html.split("./MarketSummary_files/").join("/d3-static/MarketSummary_files/");
  } else {
    // Serve the default template. D3's market landing is titled "MARKETS" (the
    // /orders board keeps the tenant title, e.g. "Sunrise Orders").
    html = await readFile(DEFAULT_TEMPLATE, "utf8");
    html = html.split("./MarketSummary_files/").join("/d3-static/MarketSummary_files/");
    html = html.replace(/<strong>\s*Dolese\s+Orders\s*<\/strong>/g, `<strong>MARKETS</strong>`);
  }

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
