"use server";

/**
 * MARKETS view data — the per-plant breakdown behind the Hercules landing page.
 *
 * D3 renders a company roll-up tile ("HMH") followed by one tile per plant
 * ("1 - HERCULES", "4 - TITAN", …). The market dimension is `orders.pricing_plant_code`,
 * verified against the live D3 board for 2026-07-22: grouping the day's orders by that
 * column reproduces the reference tile counts exactly (plants 6/5/4/7/3/1/2 ->
 * 33/28/20/20/7/5/3), and the seven plants sum to the company tile (116 orders,
 * 91 active, 25 cancelled, 5,790.59 CY).
 *
 * This module is additive: `orderActions.getDoleseSummary()` is untouched and still
 * serves the single-tile view for Dolese and every other tenant.
 */

import supabaseServer from "@/supabase/server";
import { getTenantSupabaseClient } from "@/actions/tenantActions";
import { getExcludedPatterns } from "@/actions/exclusionActions";
import { filterExcludedOrders } from "@/lib/order-filters";
import { SupabaseClient } from "@supabase/supabase-js";

// Same client resolution as orderActions: the selected tenant's Postgres cluster,
// falling back to the default server client.
async function getSupabaseClient(): Promise<SupabaseClient> {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

interface OrderProductRow {
  order_qty: number | null;
  order_qty_unit: string | null;
  delv_qty: number | null;
  is_mix: boolean | null;
  item_code?: string | null;
}

/* -------------------------------------------------------------------------
 * The three helpers below are mirrored from orderActions.ts, where they are
 * module-private. They are duplicated rather than exported so that adding the
 * MARKETS view requires no edit to the Dolese code path. Keep them in sync.
 * ---------------------------------------------------------------------- */

function dayRange(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  return { from: dateStr, to: nextDay.toISOString().slice(0, 10) };
}

/**
 * MARKETS-view quantity roll-up. Unlike orderActions' CY-only `sumCY`, this counts
 * every mix product regardless of unit, because the Hercules board includes non-CY
 * orders — notably the "/h" (per-hour) Truck Rental orders on plant 1, which the live
 * D3 board both counts AND shows a non-zero total for.
 */
function sumQty(products: OrderProductRow[] | null | undefined) {
  let ordered = 0;
  let ticketed = 0;
  for (const p of products || []) {
    if (p.is_mix === true) {
      ordered += Number(p.order_qty || 0);
      ticketed += Number(p.delv_qty || 0);
    }
  }
  return { ordered, ticketed };
}

/**
 * Tile order on the live D3 Hercules board. There is no derivable rule for it: it
 * matches no sort by plant code, plants.id, name, order count or CY, and the tenant's
 * `user_pinned_plants` table is empty. Reproduced verbatim so the board matches D3.
 * Plants not listed here sort after them by numeric code — so a newly added plant
 * appears at the end rather than disappearing.
 */
const HERCULES_PLANT_ORDER = ["3", "4", "2", "1", "7", "5", "6"];

export interface MarketSummaryRow {
  /** Plant code, or "" for the company roll-up tile. */
  key: string;
  /** Tile label: the company short code, or "<code> - <PLANT NAME>". */
  name: string;
  usedCY: number;
  totalCY: number;
  totalOrders: number;
  activeOrders: number;
  cancelledOrders: number;
  /** True for the leading roll-up tile. */
  isCompany: boolean;
}

interface Totals {
  usedCY: number;
  totalCY: number;
  totalOrders: number;
  activeOrders: number;
  cancelledOrders: number;
}

const zero = (): Totals => ({ usedCY: 0, totalCY: 0, totalOrders: 0, activeOrders: 0, cancelledOrders: 0 });

/**
 * Delivered CY per order, summed from `ticket_products.load_qty`.
 *
 * `order_products.delv_qty` — which the company tile reads — is ENTIRELY ZERO in the
 * Hercules database, so every market tile rendered "0.00 OF …" even for days that were
 * fully poured. orderActions.ts:9-11 documents the real rule: delivered concrete is the
 * sum of mix `ticket_products.load_qty` (`tickets.amount` is dollars/weight, not CY).
 *
 * Paginated the same way orderActions does it: the query layer caps every response at
 * 1000 rows, so tickets are walked by keyset and products batched ≤200 ids per request.
 */
async function loadDeliveredByOrder(
  supabase: SupabaseClient,
  orderIds: number[],
): Promise<Map<number, number>> {
  const delivered = new Map<number, number>();
  if (!orderIds.length) return delivered;

  const ticketToOrder = new Map<number, number>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("tickets")
      .select("ticket_id, order_id, remove_reason_code")
      .in("order_id", orderIds)
      .order("ticket_id")
      .range(from, from + 999);
    if (error) {
      console.error("[ERROR] loadDeliveredByOrder tickets:", error.message);
      return delivered;
    }
    const rows = (data || []) as { ticket_id: number; order_id: number; remove_reason_code: string | null }[];
    // Skip voided tickets — same rule as orderActions' isValidTicket.
    for (const t of rows) {
      if (t.remove_reason_code && t.remove_reason_code.trim() !== "") continue;
      ticketToOrder.set(Number(t.ticket_id), Number(t.order_id));
    }
    if (rows.length < 1000) break;
  }

  const tids = [...ticketToOrder.keys()];
  for (let i = 0; i < tids.length; i += 200) {
    const { data, error } = await supabase
      .from("ticket_products")
      .select("ticket_id, is_mix, load_qty, order_qty_unit")
      .in("ticket_id", tids.slice(i, i + 200));
    if (error) {
      console.error("[ERROR] loadDeliveredByOrder ticket_products:", error.message);
      return delivered;
    }
    for (const p of (data || []) as {
      ticket_id: number;
      is_mix: boolean | null;
      load_qty: number | null;
      order_qty_unit: string | null;
    }[]) {
      // CY units ONLY. Without this gate, tonnage loads were summed as cubic yards and a
      // plant could report more delivered than it ordered (3 - ZEUS read 1,201.00 CY
      // delivered against 995.50 CY ordered). Same rule as orderActions' cyByTicket.
      const unit = (p.order_qty_unit || "").toUpperCase().trim();
      const isCy = unit === "CY" || unit === "YDQ" || unit.includes("YDQ");
      if (p.is_mix !== true || !isCy) continue;
      const orderId = ticketToOrder.get(Number(p.ticket_id));
      if (orderId == null) continue;
      delivered.set(orderId, (delivered.get(orderId) || 0) + Number(p.load_qty || 0));
    }
  }
  return delivered;
}

/**
 * Delivery address to prefill the Hercules order form's "Delivery Street Address".
 *
 * The projects table's own delivery_addr* columns are NULL, so the address comes from
 * the project's (or customer's) most recent order, joining its three address lines —
 * which reproduces the live form's value exactly, e.g.
 *   "435 Martin Luther King Jr Boulevard" + "Detroit" + "Michigan 48201,United States"
 */
export async function getDeliveryAddress(opts: {
  projectId?: number;
  customerId?: number;
}): Promise<string> {
  const { projectId, customerId } = opts;
  if (!projectId && !customerId) return "";

  const supabase = await getSupabaseClient();
  let q = supabase
    .from("orders")
    .select("delivery_addr1, delivery_addr2, delivery_addr3, order_date")
    .order("order_date", { ascending: false })
    .limit(1);
  q = projectId ? q.eq("project_id", projectId) : q.eq("customer_id", customerId);

  const { data, error } = await q;
  if (error) {
    console.error("[ERROR] getDeliveryAddress:", error.message);
    return "";
  }
  const row = ((data || []) as { delivery_addr1?: string | null; delivery_addr2?: string | null; delivery_addr3?: string | null }[])[0];
  if (!row) return "";
  return [row.delivery_addr1, row.delivery_addr2, row.delivery_addr3]
    .map((s) => (s || "").trim())
    .filter(Boolean)
    .join(" ");
}

export interface MixOption {
  code: string;
  description: string;
}

/**
 * Concrete mixes for the Hercules order form's "Concrete product" dropdown.
 * `items.item_type = 'Concrete'` is the mix list (81 rows on Hercules); the other
 * item_types are aggregates, admixtures, extra charges etc.
 */
export async function getConcreteMixes(): Promise<MixOption[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("items")
    .select("code, description")
    .eq("item_type", "Concrete")
    .order("code", { ascending: true });
  if (error) {
    console.error("[ERROR] getConcreteMixes:", error.message);
    return [];
  }
  return ((data || []) as { code: string | null; description: string | null }[])
    .filter((i) => (i.code || "").trim() !== "")
    .map((i) => ({ code: String(i.code), description: (i.description || "").trim() || String(i.code) }));
}

/** plant code -> display name, from the `plants` dimension table. */
async function loadPlantNames(supabase: SupabaseClient): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const { data, error } = await supabase.from("plants").select("code, description");
  if (error) {
    console.error("[ERROR] getMarketSummaryRows plants:", error.message);
    return names;
  }
  for (const p of (data || []) as { code: string | null; description: string | null }[]) {
    const code = (p.code || "").trim();
    if (code) names.set(code, (p.description || "").trim() || code);
  }
  return names;
}

/**
 * The company roll-up tile label. The live Hercules board shows "HMH".
 *
 * We can't rely on `companies.short` for this: that table is repopulated by an upstream
 * sync that keeps resetting the value to "HC" (a DB edit to "HMH" gets reverted on the
 * next sync). This endpoint only ever serves the Hercules MARKETS view (it's gated by
 * isMarketViewTenant), so the label is forced to "HMH" here rather than read from a
 * column that won't stay put. Remove the override if the upstream data starts saying HMH.
 */
async function loadCompanyLabel(): Promise<string> {
  return "HMH";
}

/**
 * Company roll-up + per-plant totals for a date (or date range).
 * Ordering: company tile first, then plants by numeric plant code ascending.
 */
export async function getMarketSummaryRows(dateStr: string, dateToStr?: string): Promise<MarketSummaryRow[]> {
  const from = dateStr;
  const to = dateToStr ? dayRange(dateToStr).to : dayRange(dateStr).to;

  const [supabase, exclusionPatterns] = await Promise.all([getSupabaseClient(), getExcludedPatterns()]);

  // Paginate (the query layer caps at 1000 rows per request).
  const PAGE_SIZE = 1000;
  type Row = {
    order_id: number;
    order_code: string;
    customer_name: string | null;
    delivery_addr1: string | null;
    removed: boolean | null;
    remove_reason_code: string | null;
    current_status: number | null;
    pricing_plant_code: string | null;
    order_products: OrderProductRow[];
  };
  let allOrders: Row[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Plain (left) embed, NOT !inner — the Tot/Act/Can counts include orders with no
    // order_products rows (early-cancelled / will-call), matching getDoleseSummary.
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_id, order_code, customer_name, delivery_addr1, removed, remove_reason_code, current_status, pricing_plant_code, order_products(order_qty, order_qty_unit, delv_qty, is_mix, item_code)",
      )
      .gte("order_date", from)
      .lt("order_date", to)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[ERROR] getMarketSummaryRows pagination:", error.message);
      break;
    }
    if (data && data.length > 0) {
      allOrders = allOrders.concat(data as Row[]);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // NO CY-unit gate here. getDoleseSummary drops orders whose products are all non-CY
  // (verified against the live Dolese board), but Hercules counts them — its plant-1
  // "/h" Truck Rental orders appear on the live D3 board. Every order for the day counts.
  const cyOrders = allOrders;

  const filteredOrders = filterExcludedOrders(
    cyOrders.map((o) => ({
      order_id: o.order_id,
      order_code: o.order_code,
      customer_name: o.customer_name,
      delivery_addr1: o.delivery_addr1,
      order_products: o.order_products,
      removed: o.removed,
      remove_reason_code: o.remove_reason_code,
    })),
    exclusionPatterns,
  );

  const byOrderId = new Map<number | string, Row>();
  for (const o of cyOrders) byOrderId.set(o.order_id, o);

  const company = zero();
  const perPlant = new Map<string, Totals>();

  // Delivered CY comes from tickets, not order_products.delv_qty (which is all zero here).
  const delivered = await loadDeliveredByOrder(
    supabase,
    filteredOrders.map((o) => Number(o.order_id)).filter((n) => !Number.isNaN(n)),
  );

  for (const o of filteredOrders) {
    const original = byOrderId.get(o.order_id);
    const products = (original?.order_products || []) as OrderProductRow[];
    const plant = (original?.pricing_plant_code || "").trim();

    let bucket = perPlant.get(plant);
    if (!bucket) perPlant.set(plant, (bucket = zero()));

    company.totalOrders++;
    bucket.totalOrders++;

    // Cancelled = removed with a reason, EXCEPT current_status 0. Derived by reconciling
    // against the live D3 Hercules board for 2026-07-22: a pure reason-code rule is
    // impossible there (plants 1/4/5 force codes 20/15/19/8/2 to all count as cancelled,
    // which would make plant 6 eleven — the board shows ten). The one order that has to
    // drop is also the only current_status=0 row in the day, and excluding it affects no
    // other plant. Provisional: it rests on a single observation.
    if (o.removed === true && (o.remove_reason_code || "").trim() !== "" && original?.current_status !== 0) {
      company.cancelledOrders++;
      bucket.cancelledOrders++;
      continue;
    }

    company.activeOrders++;
    bucket.activeOrders++;

    const { ordered, ticketed } = sumQty(products);
    // Prefer the ticket-derived delivered volume; fall back to delv_qty if this order has
    // no ticket rows at all (keeps behaviour sane on a DB where tickets ARE populated).
    const used = delivered.get(Number(o.order_id)) ?? ticketed;
    company.totalCY += ordered;
    company.usedCY += used;
    bucket.totalCY += ordered;
    bucket.usedCY += used;
  }

  const [plantNames, companyLabel] = await Promise.all([loadPlantNames(supabase), loadCompanyLabel()]);

  const round = (n: number) => Math.round(n * 100) / 100;
  const rows: MarketSummaryRow[] = [
    { key: "", name: companyLabel, isCompany: true, ...company, usedCY: round(company.usedCY), totalCY: round(company.totalCY) },
  ];

  // D3's fixed board sequence first, then anything unlisted by numeric code ascending.
  const codes = [...perPlant.keys()].sort((a, b) => {
    const ia = HERCULES_PLANT_ORDER.indexOf(a);
    const ib = HERCULES_PLANT_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      return (ia === -1 ? Number.POSITIVE_INFINITY : ia) - (ib === -1 ? Number.POSITIVE_INFINITY : ib);
    }
    const na = /^\d+$/.test(a) ? Number(a) : Number.POSITIVE_INFINITY;
    const nb = /^\d+$/.test(b) ? Number(b) : Number.POSITIVE_INFINITY;
    return na === nb ? a.localeCompare(b) : na - nb;
  });

  for (const code of codes) {
    const t = perPlant.get(code)!;
    const label = plantNames.get(code);
    rows.push({
      key: code,
      // Unknown plant (or blank code) degrades to the raw code rather than hiding the orders.
      name: code ? (label ? `${code} - ${label}` : code) : "UNASSIGNED",
      isCompany: false,
      ...t,
      usedCY: round(t.usedCY),
      totalCY: round(t.totalCY),
    });
  }

  return rows;
}
