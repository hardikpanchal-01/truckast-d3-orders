import { readFile } from "fs/promises";
import { join } from "path";
import { getTenantBoardTitle, getSelectedTenant } from "@/actions/tenantActions";
import { applyTenantToUrl } from "@/lib/tenant-url";
import { isMarketViewTenant } from "@/lib/tenant-view";

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
  // Upstream's tenant-URL redirect (keep it — it routes the request to the tenant).
  const redirect = await applyTenantToUrl(request);
  if (redirect) return redirect;

  // Concrete Supply has its own D3 export; every other tenant uses the default shell.
  const selectedTenant = await getSelectedTenant();
  const isConcreteSupply = selectedTenant?.toLowerCase().includes("concrete");

  // Hercules renders the MARKETS view: per-plant tiles under a "MARKETS" header. The
  // flag is injected server-side so the client paints the right view first time.
  const marketView = await isMarketViewTenant();

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
    // Title: Hercules and upstream's tenants both want "MARKETS"; our other tenants keep
    // their own board title (e.g. "Dolese Orders"). getTenantBoardTitle() returns "MARKETS"
    // for the market-view tenants, so a single call covers both — no behaviour is lost.
    const title = marketView ? "MARKETS" : await getTenantBoardTitle();
    html = html.replace(/<strong>\s*Dolese\s+Orders\s*<\/strong>/g, `<strong>${title}</strong>`);
  }

  if (marketView) {
    html = html.replace("</head>", `<script>window.__MARKET_VIEW__=true;</script>\n</head>`);
  }


  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
