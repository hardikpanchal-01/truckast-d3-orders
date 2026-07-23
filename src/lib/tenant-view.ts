import { getSelectedTenant } from "@/actions/tenantActions";

/**
 * Tenants that render the D3 "MARKETS" view — a company roll-up tile followed by
 * one tile per plant — instead of the single business-unit tile.
 *
 * Hercules only, by design. Every other tenant (Dolese included) takes the exact
 * code path it took before this file existed: `isMarketViewTenant()` returns false
 * and no MARKETS branch is entered anywhere. Adding a tenant here is the only
 * change needed to opt it in.
 */
const MARKET_VIEW_TENANTS = new Set(["hercules"]);

/** Match the pg-adapter's tenant-key normalization (display name -> key). */
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function isMarketViewTenant(): Promise<boolean> {
  const selected = await getSelectedTenant();
  if (!selected) return false; // no cookie -> default tenant (dolese) -> company view
  return MARKET_VIEW_TENANTS.has(normalize(selected));
}

/**
 * The hamburger menu on Hercules' ORDER REQUEST screens carries seven items in this
 * order — no PUBLISH, no ROLLOUT, and SETTINGS/HELP/LOGOUT after TRUCKAST rather than
 * before. The D3 shells ship Dolese's nine-item list, so the whole <ul> body is swapped.
 */
const HERCULES_NAV_ITEMS: [string, string][] = [
  ["/order-request", "DASHBOARD"],
  ["/order-request/order-by-project", "ORDER FORM"],
  ["/admin", "ADMIN"],
  ["/", "TRUCKAST"],
  ["/settings", "SETTINGS"],
  ["/order-help", "HELP"],
  ["/logout", "LOGOUT"],
];

/** Swap a D3 shell's nav list for the Hercules one. No-op if the markup isn't found. */
export function applyHerculesNav(html: string): string {
  const items = HERCULES_NAV_ITEMS.map(([href, label]) => `<li><a href="${href}">${label}</a></li>`).join(
    "\n                            ",
  );
  return html.replace(
    /<ul class="nav">[\s\S]*?<\/ul>/,
    `<ul class="nav">\n                            ${items}\n                        </ul>`,
  );
}
