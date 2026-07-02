"use server";

/**
 * Order data actions for the D3 drill-down (Market Summary -> Orders -> Detail).
 * Maps the live Supabase `orders` / `order_products` / `tickets` / `ticket_products`
 * tables, mirroring the aggregation + status logic of the main TRUCKAST app.
 *
 * Key linkage facts (verified against the live DB):
 *  - Tickets join an order by `tickets.order_id` (NOT order_code, which is reused).
 *  - Delivered concrete per ticket = sum of `ticket_products.load_qty` where
 *    is_mix && order_qty_unit = 'CY' (`tickets.amount` is $/weight, not CY).
 *  - An order is COMPLETED when dispatch sets `orders.current_status = 4`.
 */

import supabaseServer from "@/supabase/server";
import { getExcludedPatterns } from "@/actions/exclusionActions";
import { filterExcludedOrders } from "@/lib/order-filters";
import { getTenantSupabaseClient, getSelectedTenant } from "@/actions/tenantActions";
import { SupabaseClient } from "@supabase/supabase-js";

// Helper to get the appropriate Supabase client (tenant-specific or default)
async function getSupabaseClient(): Promise<SupabaseClient> {
  const tenantClient = await getTenantSupabaseClient();
  return tenantClient || supabaseServer;
}

export type OrderStatus = "IN_PROCESS" | "PRE_POUR" | "COMPLETED" | "CANCELED";

export interface DoleseSummary {
  name: string;
  usedCY: number;
  totalCY: number;
  totalOrders: number;
  activeOrders: number;
  cancelledOrders: number;
}

export interface DoleseOrderListItem {
  order_id: number | string;
  order_code: string;
  order_date: string;
  customer_name: string | null;
  delivery_addr1: string | null;
  project_name: string | null;
  start_time: string | null;
  ordered_cy: number;
  ticketed_cy: number;
  status: OrderStatus;
}

export interface OrderProductInfo {
  item_code: string;
  description: string;
  qty: number;
  unit: string;
  slump: number | null;
  usage: string | null;
  is_mix: boolean;
}

export interface DoleseOrderDetail {
  order_id: number | string;
  order_code: string;
  order_date: string;
  customer_name: string | null;
  delivery_addr1: string | null;
  delivery_addr2: string | null;
  delivery_addr3: string | null;
  project_name: string | null;
  zone_name: string | null;
  plant_code: string | null;
  plant_name: string | null;
  status: OrderStatus;
  /** Raw dispatch status label (Hold, Firm, W/C, etc.) matching D3 production */
  dispatch_status: string;
  /** Scheduled time on job (from order_product_schedules) */
  scheduled_time: string | null;
  /** Load spacing in minutes */
  spacing_minutes: number | null;
  /** Purchase order number */
  purchase_order: string | null;
  /** Special instructions */
  instructions: string | null;
  /** Contact who placed the order */
  ordered_by: string | null;
  /** Products on this order */
  products: OrderProductInfo[];
  ordered_cy: number;
  ticketed_cy: number;
  on_job_cy: number;
  poured_cy: number;
  loads: number;
  trucks: number;
  /** % of loads delivered within tolerance of their expected slot (best-effort). */
  on_time_pct: number;
  /** Poured CY per hour over the pour window. */
  pour_rate: number;
  /** Delivery (plant-side) lateness, minutes — green "DOLESE" tile (best-effort). */
  dolese_delay_min: number;
  /** Job-site truck wait before unloading, minutes — red status tile. */
  job_delay_min: number;
  next_truck: string | null;
  pour_finish: string | null;
  weather: {
    temp?: string;
    description?: string;
    place?: string;
    humidity?: string;
    pressure?: string;
    wind?: string;
    direction?: string;
    updated?: string;
    icon?: string;
  } | null;
  /** ACI 305 / Menzel surface-evaporation estimate from the weather. */
  evaporation: {
    rate: number; // lb/ft^2/hr
    concreteTempF: number;
    risk: string; // "Normal" | "Take Precautions" | "Cracking Likely"
    ticketNo: string | null;
  } | null;
  charts: {
    // x values are minutes-of-day (CST clock); y values are CY/HR for pour speed chart
    tMin: number;
    tMax: number;
    ordered: number; // Scheduled delivery rate (CY/HR)
    orderedPoints: { t: number; v: number }[]; // Points at each scheduled truck arrival
    delivered: { t: number; v: number }[]; // Delivered rate (CY/HR) at each arrival
    poured: { t: number; v: number }[]; // Poured rate (CY/HR) at each pour completion
    trucks: { t: number; waiting: number; pouring: number }[];
  };
  activity: { text: string; time: string }[];
}

export interface DoleseLoad {
  ticket_id: number;
  load_no: number;
  ticket_code: string | null;
  truck_code: string | null;
  plant_name: string | null;
  load_cy: number;
  cumulative_cy: number;
  total_cy: number;
  status: string;
  status_time: string | null;
}

export interface DoleseTicketSummary {
  order_id: number;
  order_code: string;
  subtitle: string | null;
  customer_name: string | null;
  status: OrderStatus;
  loads: DoleseLoad[];
}

export interface DoleseDelayLoad {
  ticket_id: number;
  ticket_code: string | null;
  plan_min: number;
  delay_min: number;
  actual_min: number;
}

export interface DoleseCustomerDelay {
  order_id: number;
  order_code: string;
  customer_name: string | null;
  order_line: string | null;
  address_line: string | null;
  loads: DoleseDelayLoad[];
}

export interface TicketProductCard {
  item_code: string;
  description: string;
  qty: number;
  unit: string;
  slump: number | null;
  is_mix: boolean;
}

export interface TicketEventCard {
  /** icon slug — maps to a glyph in the UI (mixer, ticketed, loading, verifi …). */
  icon: string;
  title: string;
  value: string;
  sub?: string;
  badge: string;
  /** dark Verifi sensor card vs. blue truck-status card. */
  dark: boolean;
}

export interface DoleseTicketDetail {
  ticket_id: number;
  ticket_code: string;
  subtitle: string | null;
  status: string;
  plant_name: string | null;
  truck_code: string | null;
  printed_stamp: string | null;
  products: TicketProductCard[];
  events: TicketEventCard[];
}

/* ------------------------------------------------------------------ */
/*  Product / CY helpers                                              */
/* ------------------------------------------------------------------ */

interface OrderProductRow {
  order_qty: number | null;
  order_qty_unit: string | null;
  delv_qty: number | string | null;
  is_mix: boolean | null;
  item_code?: string | null;
  order_product_schedules?: { start_time: string | null }[] | null;
}

// Check if unit is a cubic yard unit (different tenants use different codes)
function isCubicYardUnit(unit: string | null | undefined): boolean {
  const u = (unit || "").toUpperCase().trim();
  return u === "CY" || u === "YDQ" || u.includes("YDQ");
}

function sumCY(products: OrderProductRow[] | null | undefined) {
  let ordered = 0;
  let ticketed = 0;
  for (const p of products || []) {
    if (isCubicYardUnit(p.order_qty_unit) && p.is_mix === true) {
      ordered += Number(p.order_qty || 0);
      ticketed += Number(p.delv_qty || 0);
    }
  }
  return { ordered, ticketed };
}

function earliestStart(products: OrderProductRow[] | null | undefined): string | null {
  const times = (products || [])
    .flatMap((p) => p.order_product_schedules || [])
    .map((s) => s.start_time)
    .filter((t): t is string => !!t && t.trim() !== "")
    .sort((a, b) => a.localeCompare(b));
  return times[0] || null;
}

function areAllLoadsTicketed(orderedQty: number, ticketedQty: number): boolean {
  if (orderedQty <= 0) return false;
  return Math.round((orderedQty - ticketedQty) * 100) / 100 <= 0.02;
}

function deriveStatus(
  order: { current_status: number | null; removed: boolean | null; remove_reason_code: string | null },
  orderedCY: number,
  ticketedCY: number,
  lastLoadCompleted: boolean,
): OrderStatus {
  if (order.removed === true && (order.remove_reason_code || "").trim() !== "") return "CANCELED";
  // Dispatch explicitly marked complete — trust it (matches the live D3 system).
  if (order.current_status === 4) return "COMPLETED";
  if (ticketedCY > 0) {
    if (lastLoadCompleted && areAllLoadsTicketed(orderedCY, ticketedCY)) return "COMPLETED";
    return "IN_PROCESS";
  }
  return "PRE_POUR";
}

/** Map dispatch current_status code to D3 production label */
const DISPATCH_STATUS_LABELS: Record<number, string> = {
  0: "Hold",
  1: "Firm",
  2: "Active",
  3: "W/C",
  4: "Complete",
  5: "Cancelled",
};

function getDispatchStatus(currentStatus: number | null, removed: boolean | null, removeReasonCode: string | null): string {
  if (removed === true && (removeReasonCode || "").trim() !== "") return "Cancelled";
  if (currentStatus == null) return "Unknown";
  return DISPATCH_STATUS_LABELS[currentStatus] || `Status ${currentStatus}`;
}

/* ------------------------------------------------------------------ */
/*  Ticket helpers                                                    */
/* ------------------------------------------------------------------ */

interface TicketRow {
  ticket_id: number;
  ticket_code: string | null;
  truck_code: string | null;
  printed_time: string | null;
  load_time: string | null;
  loaded_time: string | null;
  to_job_time: string | null;
  on_job_time: string | null;
  unload_time: string | null;
  wash_time: string | null;
  to_plant_time: string | null;
  at_plant_time: string | null;
  end_unload: string | null;
  remove_reason_code: string | null;
}

const TICKET_FIELDS =
  "ticket_id, ticket_code, truck_code, printed_time, load_time, loaded_time, to_job_time, on_job_time, unload_time, wash_time, to_plant_time, at_plant_time, end_unload, remove_reason_code";

const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

function has(t: string | null | undefined): boolean {
  return !!t && t.trim() !== "";
}

function isPouredOut(t: TicketRow): boolean {
  // A truck is "poured out" when it has finished pouring (for chart calculations)
  return has(t.end_unload) || has(t.wash_time) || has(t.to_plant_time) || has(t.at_plant_time);
}

/** Check if truck has LEFT the job site (for "On Job" calculation) */
function hasLeftJob(t: TicketRow): boolean {
  // A truck has left the job when it's heading back to plant or already at plant
  return has(t.to_plant_time) || has(t.at_plant_time);
}

/** Check if truck is currently active (not back at plant) */
function isActiveTicket(t: TicketRow): boolean {
  // A ticket is active if it has been printed but truck hasn't returned to plant
  return has(t.printed_time) && !has(t.at_plant_time);
}

function nowCSTAsUTCEpoch(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
}

function latestTicketEpoch(t: TicketRow): number | null {
  const fields = [t.printed_time, t.load_time, t.loaded_time, t.to_job_time, t.on_job_time, t.unload_time, t.wash_time, t.to_plant_time, t.at_plant_time];
  let latest: number | null = null;
  for (const s of fields) {
    if (has(s)) {
      const ms = new Date(s!).getTime();
      if (!Number.isNaN(ms) && (latest === null || ms > latest)) latest = ms;
    }
  }
  return latest;
}

function isTicketCompleted(t: TicketRow): boolean {
  if (isPouredOut(t)) return true;
  const latest = latestTicketEpoch(t);
  return latest !== null && nowCSTAsUTCEpoch() - latest >= THREE_HOURS_MS;
}

function isValidTicket(t: TicketRow): boolean {
  return !t.remove_reason_code || t.remove_reason_code.trim() === "";
}

/** Ticket lifecycle stages, oldest → newest; the latest with a timestamp is the load's status. */
const TICKET_STAGES: { field: keyof TicketRow; label: string }[] = [
  { field: "printed_time", label: "PRINTED" },
  { field: "load_time", label: "LOADING" },
  { field: "loaded_time", label: "LOADED" },
  { field: "to_job_time", label: "TO JOB" },
  { field: "on_job_time", label: "ON JOB" },
  { field: "unload_time", label: "POURING" },
  { field: "end_unload", label: "POURED" },
  { field: "wash_time", label: "WASHING" },
  { field: "to_plant_time", label: "TO PLANT" },
  { field: "at_plant_time", label: "AT PLANT" },
];

function ticketStage(t: TicketRow): { label: string; time: string | null } {
  let stage = { label: "ORDERED", time: null as string | null };
  for (const s of TICKET_STAGES) {
    const ts = t[s.field] as string | null;
    if (has(ts)) stage = { label: s.label, time: ts };
  }
  return stage;
}

/* ------------------------------------------------------------------ */
/*  Date / time formatting                                           */
/* ------------------------------------------------------------------ */

function dayRange(dateStr: string) {
  // Match D3 production: use date-only strings (YYYY-MM-DD)
  // Query uses gte(dateFrom) and lt(dateTo) where dateTo is the next day
  const [year, month, day] = dateStr.split("-").map(Number);

  // Calculate next day
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayStr = nextDay.toISOString().slice(0, 10);

  return {
    from: dateStr,        // e.g., "2026-06-30"
    to: nextDayStr,       // e.g., "2026-07-01" (next day for lt comparison)
  };
}

/** start_time / on_job_time are CST clock values in UTC fields → read UTC parts. */
function fmtTime(ts: string | null, hour12 = false): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  if (hour12) {
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, "0")} ${ap}`;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Jun 29 @ 9:18AM CST" (UTC parts = CST clock value). */
function fmtStamp(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} @ ${h}:${String(m).padStart(2, "0")}${ap} CST`;
}

/** "JUN 29 2026 2:32PM" (UTC parts = CST clock value). */
function fmtDateTimeUpper(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()} ${d.getUTCFullYear()} ${h}:${String(m).padStart(2, "0")}${ap}`;
}

/** Whole-minute difference a − b (epoch based, robust across the hour). */
function diffMin(a: string | null, b: string | null): number | null {
  if (!has(a) || !has(b)) return null;
  const ta = new Date(a!).getTime();
  const tb = new Date(b!).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((ta - tb) / 60000);
}

/** Verifi clock value "04:03:43" -> "4:03AM". */
function fmtClock(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1]);
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m[2]}${ap}`;
}

export async function getToday(): Promise<string> {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  Weather / evaporation helpers                                     */
/* ------------------------------------------------------------------ */

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
function compassDir(deg: number): string {
  return COMPASS[Math.round(deg / 22.5) % 16];
}

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * ACI 305 (Menzel) surface-evaporation rate in lb/ft²/hr.
 * Validated against the live app (air 92.55°F, RH 62%, wind 7, concrete 85°F → ≈0.057).
 */
function evaporationRate(airF: number, humidityPct: number, windMph: number, concreteF: number): number {
  const toC = (f: number) => ((f - 32) * 5) / 9;
  const Tc = toC(concreteF);
  const Ta = toC(airF);
  const r = Math.max(0, Math.min(1, humidityPct / 100));
  const V = Math.max(0, windMph) * 1.609; // km/h
  const eKg = 5 * (Math.pow(Tc + 18, 2.5) - r * Math.pow(Ta + 18, 2.5)) * (V + 4) * 1e-6; // kg/m²/h
  const eLb = Math.max(0, eKg) * 0.2048; // → lb/ft²/h
  return Math.round(eLb * 1000) / 1000;
}

/** ACI 305 shrinkage-cracking risk bands for the evaporation rate. */
function crackingRisk(rate: number): string {
  if (rate >= 0.2) return "Cracking Likely";
  if (rate >= 0.1) return "Take Precautions";
  return "Normal";
}

/* ------------------------------------------------------------------ */
/*  1. Market summary (business-unit aggregate)                        */
/* ------------------------------------------------------------------ */

export async function getDoleseSummary(dateStr: string, dateToStr?: string): Promise<DoleseSummary> {
  // Support date ranges: if dateToStr is provided, query from dateStr to dateToStr (inclusive)
  const from = dateStr;
  const to = dateToStr ? dayRange(dateToStr).to : dayRange(dateStr).to;

  // Get tenant-specific Supabase client and selected tenant name
  const [supabase, selectedTenant, exclusionPatterns] = await Promise.all([
    getSupabaseClient(),
    getSelectedTenant(),
    getExcludedPatterns(),
  ]);

  const tenantName = selectedTenant || "DOLESE";

  // Paginate through all orders (Supabase default limit is 1000)
  const PAGE_SIZE = 1000;
  let allOrders: Array<{
    order_id: number;
    order_code: string;
    customer_name: string | null;
    delivery_addr1: string | null;
    removed: boolean | null;
    remove_reason_code: string | null;
    order_products: OrderProductRow[];
  }> = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from("orders")
      .select("order_id, order_code, customer_name, delivery_addr1, removed, remove_reason_code, order_products!inner(order_qty, order_qty_unit, delv_qty, is_mix, item_code)")
      .gte("order_date", from)
      .lt("order_date", to)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[ERROR] getDoleseSummary pagination:", error.message);
      break;
    }

    if (data && data.length > 0) {
      allOrders = allOrders.concat(data as typeof allOrders);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // Filter to only CY/YDQ orders - different tenants use different unit codes
  // CY = Cubic Yards (standard), YDQ = Cubic Yards (some tenants like Stevenson Weir)
  const cyOrders = allOrders.filter((o) => {
    const products = (o.order_products || []) as OrderProductRow[];
    return products.some((p) => isCubicYardUnit(p.order_qty_unit));
  });

  // Apply exclusion patterns filtering (matches D3 production)
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
    exclusionPatterns
  );

  let totalCY = 0, usedCY = 0, totalOrders = 0, activeOrders = 0, cancelledOrders = 0;
  for (const o of filteredOrders) {
    const original = cyOrders.find((x) => x.order_id === o.order_id);
    const products = (original?.order_products || []) as OrderProductRow[];
    totalOrders++;
    if (o.removed === true && (o.remove_reason_code || "").trim() !== "") {
      cancelledOrders++;
      continue;
    }
    activeOrders++;
    const { ordered, ticketed } = sumCY(products);
    totalCY += ordered;
    usedCY += ticketed;
  }

  return {
    name: tenantName,
    usedCY: Math.round(usedCY * 100) / 100,
    totalCY: Math.round(totalCY * 100) / 100,
    totalOrders, activeOrders, cancelledOrders,
  };
}

/* ------------------------------------------------------------------ */
/*  2. Orders list for a day                                          */
/* ------------------------------------------------------------------ */

export async function getDoleseOrders(dateStr: string): Promise<DoleseOrderListItem[]> {
  const { from, to } = dayRange(dateStr);

  // Get tenant-specific Supabase client first
  const supabase = await getSupabaseClient();

  // Fetch orders and exclusion patterns in parallel
  const [ordersResult, exclusionPatterns] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products!inner(order_qty, order_qty_unit, delv_qty, is_mix, item_code, order_product_schedules(start_time))",
      )
      .gte("order_date", from)
      .lt("order_date", to)
      .order("order_date", { ascending: true })
      .limit(1000),
    getExcludedPatterns(),
  ]);

  const { data, error } = ordersResult;

  if (error) {
    console.error("[ERROR] getDoleseOrders:", error.message);
    return [];
  }

  // Filter to only CY/YDQ orders (different tenants use different unit codes)
  const cyOrders = (data || []).filter((o) =>
    ((o.order_products || []) as OrderProductRow[]).some((p) => isCubicYardUnit(p.order_qty_unit)),
  );

  // Apply exclusion patterns filtering (matches D3 production)
  const filteredOrders = filterExcludedOrders(
    cyOrders.map((o) => ({
      order_id: o.order_id,
      order_code: o.order_code,
      customer_name: o.customer_name,
      delivery_addr1: o.delivery_addr1,
      order_products: o.order_products,
    })),
    exclusionPatterns
  );

  // Get the filtered order IDs
  const filteredIds = new Set(filteredOrders.map((o) => o.order_id));

  // Map to DoleseOrderListItem, only including filtered orders
  const items: DoleseOrderListItem[] = cyOrders
    .filter((o) => filteredIds.has(o.order_id))
    .map((o) => {
      const products = (o.order_products || []) as OrderProductRow[];
      const { ordered, ticketed } = sumCY(products);
      return {
        order_id: o.order_id,
        order_code: o.order_code,
        order_date: o.order_date,
        customer_name: o.customer_name,
        delivery_addr1: o.delivery_addr1,
        project_name: o.project_name,
        start_time: earliestStart(products),
        ordered_cy: Math.round(ordered * 100) / 100,
        ticketed_cy: Math.round(ticketed * 100) / 100,
        // current_status === 4 covers "completed"; no per-order ticket fetch needed here.
        status: deriveStatus(o, ordered, ticketed, false),
      };
    });

  const rank: Record<OrderStatus, number> = { IN_PROCESS: 0, PRE_POUR: 1, COMPLETED: 2, CANCELED: 3 };
  items.sort((a, b) => {
    const r = rank[a.status] - rank[b.status];
    if (r !== 0) return r;
    return (a.start_time || "").localeCompare(b.start_time || "");
  });
  return items;
}

/* ------------------------------------------------------------------ */
/*  3. Single order detail                                            */
/* ------------------------------------------------------------------ */

export async function getDoleseOrderDetail(orderId: number | string): Promise<DoleseOrderDetail | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  // Handle both integer and UUID order IDs
  const isUUID = typeof orderId === "string" && orderId.includes("-");
  const orderIdValue = isUUID ? orderId : Number(orderId);

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      `order_id, order_code, order_date, customer_name, delivery_addr1, delivery_addr2, delivery_addr3,
       project_name, zone_name, pricing_plant_code, current_status, removed, remove_reason_code, weather_data,
       purchase_order, ordered_by_name, ordered_by_phone,
       instruction_addr1, instruction_addr2, instruction_addr3, instruction_addr4, instruction_addr5, instruction_addr6,
       order_products(order_qty, order_qty_unit, delv_qty, is_mix, item_code, description, slump, usage_name, order_product_schedules(start_time, truck_space, plant_code, delivery_rate_per_hour, number_of_loads))`,
    )
    .eq("order_id", orderIdValue)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseOrderDetail:", error.message);
    return null;
  }

  const rawProducts = (order.order_products || []) as (OrderProductRow & {
    description?: string | null;
    slump?: number | null;
    usage_name?: string | null;
  })[];
  const { ordered, ticketed } = sumCY(rawProducts);

  // Build products array for order details
  const productsInfo: OrderProductInfo[] = rawProducts.map((p) => ({
    item_code: p.item_code || "—",
    description: p.description || "",
    qty: Number(p.order_qty || 0),
    unit: (p.order_qty_unit || "").toUpperCase(),
    slump: p.slump != null ? Number(p.slump) : null,
    usage: p.usage_name || null,
    is_mix: p.is_mix === true,
  }));

  // Get scheduled time from order_product_schedules
  const scheduledTime = earliestStart(rawProducts);

  // Get schedule data (truck_space, delivery_rate_per_hour, number_of_loads) from the first product schedule
  type ScheduleData = {
    start_time: string | null;
    truck_space?: number | null;
    plant_code?: string | null;
    delivery_rate_per_hour?: number | null;
    number_of_loads?: number | null;
  };
  const firstSchedule = rawProducts
    .flatMap((p) => (p.order_product_schedules || []) as ScheduleData[])
    .find((s) => s.start_time);
  const spacingMinutes = firstSchedule?.truck_space ?? null;
  const deliveryRatePerHour = firstSchedule?.delivery_rate_per_hour ?? null;
  const numberOfLoads = firstSchedule?.number_of_loads ?? null;

  // Plant name: Get from first ticket (matches D3 production behavior)
  // D3 shows the plant from the first ticket, not from order_product_schedules
  let plantName: string | null = null;
  const { data: firstTicket } = await supabase
    .from("tickets")
    .select("plant_name, plant_code")
    .eq("order_id", orderId)
    .order("printed_time", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstTicket?.plant_name) {
    plantName = firstTicket.plant_name;
  } else if (firstTicket?.plant_code || firstSchedule?.plant_code || order.pricing_plant_code) {
    // Fallback: look up from plants table
    const plantCode = firstTicket?.plant_code || firstSchedule?.plant_code || order.pricing_plant_code;
    const { data: plant } = await supabase
      .from("plants")
      .select("description, short_description")
      .eq("code", plantCode)
      .maybeSingle();
    plantName = plant?.description || plant?.short_description || plantCode;
  }

  // Build instructions from instruction_addr fields
  const instrOrder = order as {
    instruction_addr1?: string | null;
    instruction_addr2?: string | null;
    instruction_addr3?: string | null;
    instruction_addr4?: string | null;
    instruction_addr5?: string | null;
    instruction_addr6?: string | null;
  };
  const instructionParts = [
    instrOrder.instruction_addr1,
    instrOrder.instruction_addr2,
    instrOrder.instruction_addr3,
    instrOrder.instruction_addr4,
    instrOrder.instruction_addr5,
    instrOrder.instruction_addr6,
  ].filter((s) => s && s.trim() !== "");
  const instructions = instructionParts.length > 0 ? instructionParts.join(" ") : null;

  // Tickets joined by order_id (the reliable key).
  const { data: tix } = await supabase
    .from("tickets")
    .select(TICKET_FIELDS)
    .eq("order_id", orderId)
    .limit(500);
  const tickets = ((tix || []) as TicketRow[]).filter(isValidTicket);

  // Delivered CY per ticket = sum of mix ticket_products.load_qty (CY).
  const cyByTicket = new Map<number, number>();
  if (tickets.length > 0) {
    const { data: tp } = await supabase
      .from("ticket_products")
      .select("ticket_id, is_mix, load_qty, order_qty_unit")
      .in("ticket_id", tickets.map((t) => t.ticket_id))
      .limit(2000);
    for (const p of tp || []) {
      if (p.is_mix === true && isCubicYardUnit(p.order_qty_unit)) {
        cyByTicket.set(p.ticket_id, (cyByTicket.get(p.ticket_id) || 0) + Number(p.load_qty || 0));
      }
    }
  }

  const loads = tickets.length;

  // Count only trucks that are currently active (not back at plant yet)
  const activeTickets = tickets.filter((t) => isActiveTicket(t));
  const trucks = new Set(activeTickets.map((t) => t.truck_code).filter(Boolean)).size;

  // Calculate actual ticketed CY from ticket_products (sum of all delivered loads)
  // This is more accurate than order_products.delv_qty which may not be updated
  let actualTicketedCY = 0;
  for (const cy of cyByTicket.values()) {
    actualTicketedCY += cy;
  }

  // On job = trucks that have arrived at job site but haven't LEFT yet
  // (trucks can be pouring or done pouring but still physically at job site)
  const onJobCY = tickets
    .filter((t) => has(t.on_job_time) && !hasLeftJob(t))
    .reduce((s, t) => s + (cyByTicket.get(t.ticket_id) || 0), 0);

  // --- Chart data ---------------------------------------------------
  // x axis = minutes-of-day (CST clock value stored in UTC field).
  const tsMin = (ts: string | null): number | null => {
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.getUTCHours() * 60 + d.getUTCMinutes();
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pourOutTime = (t: TicketRow): string | null =>
    t.end_unload || t.wash_time || t.at_plant_time || t.to_plant_time;

  // Pour Speed chart shows CY/HR rate, not cumulative CY
  // Delivered rate: cumulative_qty / elapsed_hours (from first delivery)
  const deliveredTickets = tickets
    .filter((t) => tsMin(t.on_job_time) != null)
    .sort((a, b) => (a.on_job_time || "").localeCompare(b.on_job_time || ""));

  // Calculate scheduled rate to use as baseline/cap
  const scheduleRate = deliveryRatePerHour && deliveryRatePerHour > 0 ? deliveryRatePerHour : 30; // default 30 CY/HR if not available
  const maxRateCap = scheduleRate * 1.5; // Cap at 1.5x schedule rate

  // First delivery time (used as reference for elapsed time calculation)
  const firstDeliveryTime = deliveredTickets.length > 0 && deliveredTickets[0].on_job_time
    ? new Date(deliveredTickets[0].on_job_time).getTime()
    : null;

  let cumD = 0;
  const delivered = deliveredTickets.map((t, index) => {
    cumD += cyByTicket.get(t.ticket_id) || 0;
    const deliveryTime = new Date(t.on_job_time!).getTime();

    let rate: number;
    if (index === 0 || !firstDeliveryTime) {
      // First delivery: use schedule rate
      rate = scheduleRate;
    } else {
      // Calculate elapsed hours from first delivery
      const elapsedMs = deliveryTime - firstDeliveryTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      if (elapsedHours > 0) {
        rate = Math.min(cumD / elapsedHours, maxRateCap);
      } else {
        rate = scheduleRate;
      }
    }
    return { t: tsMin(t.on_job_time)!, v: r2(rate) };
  });

  // Poured rate: cumulative_qty / elapsed_hours (from first delivery)
  const pouredTickets = tickets
    .filter((t) => tsMin(pourOutTime(t)) != null)
    .sort((a, b) => (pourOutTime(a) || "").localeCompare(pourOutTime(b) || ""));

  let cumP = 0;
  const poured = pouredTickets.map((t) => {
    cumP += cyByTicket.get(t.ticket_id) || 0;
    const pourTime = new Date(pourOutTime(t)!).getTime();

    let rate: number;
    if (!firstDeliveryTime) {
      rate = scheduleRate;
    } else {
      // Calculate elapsed hours from first delivery
      const elapsedMs = pourTime - firstDeliveryTime;
      const elapsedHours = elapsedMs / (1000 * 60 * 60);
      if (elapsedHours > 0) {
        rate = Math.min(cumP / elapsedHours, maxRateCap);
      } else {
        rate = scheduleRate;
      }
    }
    return { t: tsMin(pourOutTime(t))!, v: r2(rate) };
  });

  // Trucks on the job: waiting (arrived, not pouring) vs pouring, over time.
  const spans = tickets
    .map((t) => {
      const arrive = tsMin(t.on_job_time);
      if (arrive == null) return null;
      return { arrive, pourStart: tsMin(t.unload_time), pourEnd: tsMin(pourOutTime(t)) };
    })
    .filter((s): s is { arrive: number; pourStart: number | null; pourEnd: number | null } => s != null);

  const eventTimes = Array.from(
    new Set(spans.flatMap((s) => [s.arrive, s.pourStart, s.pourEnd].filter((x): x is number => x != null))),
  ).sort((a, b) => a - b);

  const trucks_series = eventTimes.map((t) => {
    let waiting = 0;
    let pouring = 0;
    for (const s of spans) {
      if (s.pourEnd != null && t >= s.pourEnd) continue; // departed
      const started = s.pourStart != null && t >= s.pourStart;
      if (started) pouring++;
      else if (t >= s.arrive) waiting++;
    }
    return { t, waiting, pouring };
  });

  // Include scheduled start time in the time range (like D3)
  const scheduleStartMin = scheduledTime ? tsMin(scheduledTime) : null;
  const allT = [
    ...delivered.map((p) => p.t),
    ...poured.map((p) => p.t),
    ...eventTimes,
    ...(scheduleStartMin != null ? [scheduleStartMin] : []),
  ];
  const tMin = allT.length ? Math.min(...allT) : 0;
  const tMax = allT.length ? Math.max(...allT) : 0;

  // Generate scheduled order points for the "Ordered" line
  // Each point is spaced by truck_space minutes, all at delivery_rate_per_hour
  const scheduledOrderPoints: { t: number; v: number }[] = [];
  if (scheduledTime && spacingMinutes && spacingMinutes > 0 && numberOfLoads && numberOfLoads > 0) {
    const startMin = tsMin(scheduledTime);
    if (startMin != null) {
      for (let i = 0; i < numberOfLoads; i++) {
        scheduledOrderPoints.push({
          t: startMin + i * spacingMinutes,
          v: r2(scheduleRate),
        });
      }
    }
  }

  const charts = {
    tMin,
    tMax,
    ordered: r2(scheduleRate), // Scheduled delivery rate (CY/HR)
    orderedPoints: scheduledOrderPoints, // Points at each scheduled truck arrival
    delivered,
    poured,
    trucks: trucks_series,
  };

  // --- Production stat tiles ---------------------------------------
  // Poured = cumulative CY that has finished unloading (falls back to delivered).
  const pouredCY = poured.length ? poured[poured.length - 1].v : r2(ticketed);

  // Pour rate (CY/HR) over the pour window (first unload → last pour-out).
  const pourStarts = tickets.map((t) => tsMin(t.unload_time)).filter((x): x is number => x != null);
  const pourEnds = tickets.map((t) => tsMin(pourOutTime(t))).filter((x): x is number => x != null);
  let pourRate = 0;
  if (pourStarts.length && pourEnds.length) {
    const durMin = Math.max(...pourEnds) - Math.min(...pourStarts);
    if (durMin > 0) pourRate = pouredCY / (durMin / 60);
  }

  // Arrivals (sorted) drive on-time % and Dolese (delivery) delay.
  const arrivals = deliveredTickets
    .map((t) => tsMin(t.on_job_time))
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < arrivals.length; i++) gaps.push(arrivals[i] - arrivals[i - 1]);
  const targetGap = median(gaps);
  const TOL = 5; // minutes of slack before a load counts as late
  let onTimeLoads = 0;
  let doleseDelay = 0;
  for (let i = 0; i < arrivals.length; i++) {
    const expected = arrivals[0] + i * targetGap;
    if (arrivals[i] <= expected + TOL) onTimeLoads++;
    doleseDelay += Math.max(0, arrivals[i] - expected);
  }
  const onTimePct = arrivals.length ? Math.round((100 * onTimeLoads) / arrivals.length) : 0;
  doleseDelay = Math.round(doleseDelay);

  // Job-site delay = total truck wait on site before unloading begins.
  let jobDelay = 0;
  for (const t of tickets) {
    const arr = tsMin(t.on_job_time);
    const start = tsMin(t.unload_time);
    if (arr != null && start != null && start > arr) jobDelay += start - arr;
  }
  jobDelay = Math.round(jobDelay);

  // Activity feed: truck-movement messages derived from ticket timestamps
  // (newest first). Status/product-change history isn't available in the data.
  const addrLabel = order.delivery_addr1 || order.project_name || "the job";
  const moved = tickets
    .filter((t) => has(t.to_job_time) || has(t.on_job_time))
    .sort((a, b) =>
      (b.to_job_time || b.on_job_time || "").localeCompare(a.to_job_time || a.on_job_time || ""),
    );
  const activity = moved
    .map((t, idx) => {
      const stamp = fmtStamp(t.to_job_time || t.on_job_time);
      if (!stamp || !t.truck_code) return null;
      const arrive = fmtTime(t.on_job_time || t.to_job_time, false) || "";
      const text =
        idx === 0
          ? `Truck ${t.truck_code} is your last load for ${addrLabel}. If you need more concrete, please call Dispatch.`
          : `Truck ${t.truck_code} heading to ${addrLabel} and is expected to arrive at ${arrive}`;
      return { text, time: stamp };
    })
    .filter((m): m is { text: string; time: string } => m != null);

  const lastTicket = tickets.length
    ? tickets.reduce((a, b) => ((b.ticket_code || "") > (a.ticket_code || "") ? b : a))
    : null;
  const status = deriveStatus(order, ordered, actualTicketedCY, lastTicket ? isTicketCompleted(lastTicket) : false);

  // Pour Finish: estimated completion time
  // Use the latest scheduled time if available, otherwise use last ticket's estimated pour time
  const allScheduleTimes = rawProducts
    .flatMap((p) => (p.order_product_schedules || []) as { start_time: string | null; number_of_loads?: number | null; truck_space?: number | null }[])
    .filter((s) => s.start_time);

  let pourFinish: string | null = null;
  if (allScheduleTimes.length > 0 && allScheduleTimes[0].number_of_loads && allScheduleTimes[0].truck_space) {
    // Calculate estimated finish based on schedule: start_time + (number_of_loads * truck_space)
    const schedule = allScheduleTimes[0];
    const startTime = new Date(schedule.start_time!);
    const totalMinutes = (schedule.number_of_loads || 0) * (schedule.truck_space || 0);
    const finishTime = new Date(startTime.getTime() + totalMinutes * 60 * 1000);
    pourFinish = fmtTime(finishTime.toISOString(), true);
  } else {
    // Fallback: use last pour end time
    const pourFinishRaw = tickets
      .map((t) => t.end_unload || t.wash_time)
      .filter((x): x is string => !!x)
      .sort();
    pourFinish = pourFinishRaw.length ? fmtTime(pourFinishRaw[pourFinishRaw.length - 1], true) : null;
  }

  // Next Truck: find the next truck en route or calculate minutes until next arrival
  let nextTruck: string | null = null;
  if (status !== "COMPLETED") {
    // Find trucks that are en route (have to_job_time but no on_job_time yet)
    const enRouteTickets = tickets
      .filter((t) => has(t.to_job_time) && !has(t.on_job_time))
      .sort((a, b) => (a.to_job_time || "").localeCompare(b.to_job_time || ""));

    if (enRouteTickets.length > 0) {
      // Calculate minutes until arrival based on average travel time
      const arrivedTickets = tickets.filter((t) => has(t.to_job_time) && has(t.on_job_time));
      let avgTravelMin = 15; // default 15 minutes travel time
      if (arrivedTickets.length > 0) {
        const travelTimes = arrivedTickets
          .map((t) => diffMin(t.on_job_time, t.to_job_time))
          .filter((x): x is number => x != null && x > 0);
        if (travelTimes.length > 0) {
          avgTravelMin = Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length);
        }
      }

      // Calculate when the en route truck will arrive
      const nextTicket = enRouteTickets[0];
      const departTime = new Date(nextTicket.to_job_time!).getTime();
      const nowMs = nowCSTAsUTCEpoch();
      const etaMs = departTime + avgTravelMin * 60 * 1000;
      const minsUntilArrival = Math.max(0, Math.round((etaMs - nowMs) / 60000));

      if (minsUntilArrival <= 0) {
        nextTruck = "Now";
      } else {
        nextTruck = `${minsUntilArrival} MIN`;
      }
    } else {
      // No trucks en route, show scheduled time
      nextTruck = fmtTime(earliestStart(rawProducts), true);
    }
  }

  // Weather (JSONB shape varies; best-effort)
  let weather: DoleseOrderDetail["weather"] = null;
  let evaporation: DoleseOrderDetail["evaporation"] = null;
  const w = order.weather_data as Record<string, unknown> | null;
  if (w && typeof w === "object") {
    const temp =
      (w.temperature as number | string | undefined) ??
      (w.temp as number | string | undefined) ??
      ((w.main as Record<string, unknown>)?.temp as number | undefined);
    const desc =
      (w.description as string | undefined) ??
      (Array.isArray(w.weather) ? ((w.weather[0] as Record<string, unknown>)?.description as string) : undefined);
    const main = (w.main as Record<string, unknown>) || {};
    const wind = (w.wind as Record<string, unknown>) || {};
    const humidity = (w.humidity ?? main.humidity) as number | undefined;
    const pressure = (w.pressure ?? main.pressure) as number | undefined;
    const windSpeed = (w.wind_speed ?? wind.speed) as number | undefined;
    const windDeg = (w.wind_deg ?? wind.deg) as number | undefined;
    const dt = (w.dt ?? w.last_update ?? w.updated) as number | string | undefined;
    const icon =
      (w.icon as string | undefined) ??
      (Array.isArray(w.weather) ? ((w.weather[0] as Record<string, unknown>)?.icon as string) : undefined);
    if (temp != null || desc) {
      const windVal = windSpeed != null ? Math.round(Number(windSpeed) * 100) / 100 : null;
      weather = {
        temp: temp != null ? `${temp}°F` : undefined,
        description: desc,
        place: order.pricing_plant_code || undefined,
        humidity: humidity != null ? `${humidity}%` : undefined,
        pressure: pressure != null ? String(pressure) : undefined,
        wind: windVal != null ? String(windVal) : undefined,
        direction: windDeg != null ? compassDir(Number(windDeg)) : undefined,
        updated:
          typeof dt === "number"
            ? new Date(dt * 1000).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
            : typeof dt === "string"
              ? dt
              : undefined,
        icon: typeof icon === "string" ? icon : undefined,
      };

      // Surface-evaporation estimate (assumes concrete placed at 85°F, as the live app does).
      const airF = typeof temp === "number" ? temp : Number(temp);
      if (Number.isFinite(airF) && humidity != null && windVal != null) {
        const CONCRETE_F = 85;
        const rate = evaporationRate(airF, Number(humidity), windVal, CONCRETE_F);
        evaporation = {
          rate,
          concreteTempF: CONCRETE_F,
          risk: crackingRisk(rate),
          ticketNo: lastTicket?.ticket_code ?? null,
        };
      }
    }
  }

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    order_date: order.order_date,
    customer_name: order.customer_name,
    delivery_addr1: order.delivery_addr1,
    delivery_addr2: order.delivery_addr2,
    delivery_addr3: order.delivery_addr3,
    project_name: order.project_name,
    zone_name: order.zone_name,
    plant_code: order.pricing_plant_code,
    plant_name: plantName,
    status,
    dispatch_status: getDispatchStatus(order.current_status, order.removed, order.remove_reason_code),
    scheduled_time: scheduledTime ? fmtDateTimeUpper(scheduledTime) : null,
    spacing_minutes: spacingMinutes,
    purchase_order: (order as { purchase_order?: string | null }).purchase_order || null,
    instructions,
    ordered_by: (order as { ordered_by_name?: string | null; ordered_by_phone?: string | null }).ordered_by_name
      ? `${(order as { ordered_by_name?: string | null }).ordered_by_name || ""}${(order as { ordered_by_phone?: string | null }).ordered_by_phone ? ` ${(order as { ordered_by_phone?: string | null }).ordered_by_phone}` : ""}`.trim() || null
      : null,
    products: productsInfo,
    ordered_cy: Math.round(ordered * 100) / 100,
    ticketed_cy: Math.round(actualTicketedCY * 100) / 100,
    on_job_cy: Math.round(onJobCY * 100) / 100,
    poured_cy: pouredCY,
    loads,
    trucks,
    on_time_pct: onTimePct,
    pour_rate: Math.round(pourRate * 100) / 100,
    dolese_delay_min: doleseDelay,
    job_delay_min: jobDelay,
    next_truck: nextTruck,
    pour_finish: pourFinish,
    weather,
    evaporation,
    charts,
    activity,
  };
}

/* ------------------------------------------------------------------ */
/*  4. Ticket (load) summary — one card per delivered load           */
/* ------------------------------------------------------------------ */

export async function getDoleseTicketSummary(orderId: number): Promise<DoleseTicketSummary | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "order_id, order_code, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products(order_qty, order_qty_unit, delv_qty, is_mix)",
    )
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseTicketSummary:", error.message);
    return null;
  }

  const products = (order.order_products || []) as OrderProductRow[];
  const { ordered, ticketed } = sumCY(products);
  const totalCY = Math.round(ordered * 100) / 100;

  const { data: tix } = await supabase
    .from("tickets")
    .select(`${TICKET_FIELDS}, plant_name`)
    .eq("order_id", orderId)
    .limit(500);
  const tickets = ((tix || []) as (TicketRow & { plant_name: string | null })[]).filter(isValidTicket);

  // Delivered CY per ticket = sum of mix ticket_products.load_qty (CY).
  const cyByTicket = new Map<number, number>();
  if (tickets.length > 0) {
    const { data: tp } = await supabase
      .from("ticket_products")
      .select("ticket_id, is_mix, load_qty, order_qty_unit")
      .in("ticket_id", tickets.map((t) => t.ticket_id))
      .limit(2000);
    for (const p of tp || []) {
      if (p.is_mix === true && isCubicYardUnit(p.order_qty_unit)) {
        cyByTicket.set(p.ticket_id, (cyByTicket.get(p.ticket_id) || 0) + Number(p.load_qty || 0));
      }
    }
  }

  // Order loads by their creation/print sequence (fallback: ticket_code).
  const sorted = [...tickets].sort((a, b) =>
    (a.printed_time || "").localeCompare(b.printed_time || "") ||
    (a.ticket_code || "").localeCompare(b.ticket_code || ""),
  );

  let cumulative = 0;
  const loads: DoleseLoad[] = sorted.map((t, i) => {
    const cy = Math.round((cyByTicket.get(t.ticket_id) || 0) * 100) / 100;
    cumulative = Math.round((cumulative + cy) * 100) / 100;
    const stage = ticketStage(t);
    return {
      ticket_id: t.ticket_id,
      load_no: i + 1,
      ticket_code: t.ticket_code,
      truck_code: t.truck_code,
      plant_name: t.plant_name,
      load_cy: cy,
      cumulative_cy: cumulative,
      total_cy: totalCY,
      status: stage.label,
      status_time: stage.time ? (fmtTime(stage.time, true) || "").replace(/\s+/g, "") : null,
    };
  });

  const status = deriveStatus(order, ordered, ticketed, false);

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    subtitle: order.delivery_addr1 || order.project_name || null,
    customer_name: order.customer_name,
    status,
    loads,
  };
}

/* ------------------------------------------------------------------ */
/*  5. Ticket detail — full ticket / Verifi breakdown                 */
/* ------------------------------------------------------------------ */

/** Read a Verifi nested measurement, e.g. { slump, slumpUnits } or { volumeValue }. */
function vVal(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const v = o[key];
  return v == null || v === "" ? null : String(v);
}

export async function getDoleseTicketDetail(ticketId: number): Promise<DoleseTicketDetail | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: t, error } = await supabase
    .from("tickets")
    .select(
      `${TICKET_FIELDS}, plant_name, plant_code, delivery_addr1, project_name, current_status, order_current_status, verifi_json`,
    )
    .eq("ticket_id", ticketId)
    .limit(1)
    .maybeSingle();

  if (error || !t) {
    if (error) console.error("[ERROR] getDoleseTicketDetail:", error.message);
    return null;
  }

  const { data: tp } = await supabase
    .from("ticket_products")
    .select("item_code, description, short_description, is_mix, load_qty, delv_qty, order_qty_unit, delv_qty_unit, slump")
    .eq("ticket_id", ticketId)
    .limit(50);

  // ORDER product cards (mix shown green in the UI).
  const products: TicketProductCard[] = (tp || []).map((p) => {
    const unitRaw = (p.order_qty_unit || p.delv_qty_unit || "ea").toLowerCase();
    return {
      item_code: p.item_code || "—",
      description: p.description || p.short_description || "",
      qty: Number(p.load_qty ?? p.delv_qty ?? 0),
      unit: unitRaw === "ea" ? "EACH" : (p.order_qty_unit || p.delv_qty_unit || "").toUpperCase(),
      slump: p.slump != null ? Number(p.slump) : null,
      is_mix: p.is_mix === true,
    };
  });

  const v = (t.verifi_json as Record<string, unknown> | null) || null;
  const mix = (v?.mixCodeName as string) || products.find((p) => p.is_mix)?.item_code || "—";
  const truck = t.truck_code || "";
  const events: TicketEventCard[] = [];

  // --- Blue truck-status timeline (from ticket timestamps) ---------
  const stage = (
    icon: string,
    label: string,
    badge: string,
    ts: string | null,
    verifiClock: string | null,
  ) => {
    if (!has(ts)) return;
    events.push({
      icon,
      title: `TRUCK ${truck} ${label}:`,
      value: (fmtTime(ts, true) || "").replace(/\s+/g, ""),
      sub: verifiClock ? `VERIFI: ${verifiClock}` : undefined,
      badge,
      dark: false,
    });
  };
  stage("ticketed", "Ticketed", "TICKETED", t.printed_time, fmtClock(v?.ticketSent as string));
  stage("loading", "Loading", "LOADING", t.load_time, fmtClock(v?.loading as string));
  stage("loaded", "Loaded", "LOADED", t.loaded_time, fmtClock(v?.loaded as string));
  stage("to_job", "To Job", "TO JOB", t.to_job_time, fmtClock(v?.leavePlant as string));
  stage("at_job", "At Job", "AT JOB", t.on_job_time, fmtClock((v?.arriveSite as string) || (v?.calculatedArriveSite as string)));
  stage("pouring", "Pouring", "POURING", t.unload_time, fmtClock(v?.beginPour as string));
  stage("poured", "End Pour", "POURED", t.end_unload, fmtClock(v?.endPour as string));
  stage("washing", "Washing", "WASHING", t.wash_time, null);
  stage("to_plant", "To Plant", "TO PLANT", t.to_plant_time, fmtClock(v?.leaveSite as string));
  stage("at_plant", "At Plant", "AT PLANT", t.at_plant_time, fmtClock(v?.returnPlant as string));

  // --- Dark Verifi sensor cards (per delivery stage) ---------------
  if (v) {
    // suffix matches the Verifi JSON key tail, e.g. slump + "AtArrival" = slumpAtArrival.
    const STAGES: { badge: string; suffix: string }[] = [
      { badge: "TO JOB", suffix: "AtLeavePlant" },
      { badge: "AT JOB", suffix: "AtArrival" },
      { badge: "AT JOB", suffix: "AtDischarge" },
    ];
    for (const s of STAGES) {
      const slump = vVal(v[`slump${s.suffix}`], "slump");
      const temp = vVal(v[`temperature${s.suffix}`], "temperatureUnitsValue");
      const age = vVal(v[`age${s.suffix}Minutes`], "age");
      const revsRaw = v[`totalRevs${s.suffix}`];
      const revs = revsRaw == null || revsRaw === "" ? null : String(revsRaw);
      const water = vVal(v[`verifiWater${s.suffix}`], "volumeValue");
      const admix = vVal(v[`admix${s.suffix}`], "volumeValue");

      const metric = (label: string, value: string | null, unit: string, sub: string) =>
        events.push({
          icon: "verifi",
          title: mix,
          value: `${label}: ${value != null ? `${value}${unit}` : label === "SLUMP" ? "NM" : "NA"}`,
          sub,
          badge: s.badge,
          dark: true,
        });

      metric("AGE", age, " min", s.badge);
      metric("SLUMP", slump, " IN", s.badge);
      metric("TEMP", temp, "°F", s.badge);
      metric("REVS", revs, "", s.badge);
      metric("WATER", water ?? "0.0", " GAL/CY", `${s.badge} - VERIFI WATER ADD`);
      metric("ADMIX", admix ?? "0.0", " OZ/CY", s.badge);
    }
  }

  const statusLabel =
    t.current_status === 4 || t.order_current_status === 4
      ? "COMPLETE"
      : has(t.at_plant_time)
        ? "COMPLETE"
        : "IN PROCESS";

  return {
    ticket_id: t.ticket_id,
    ticket_code: t.ticket_code || String(ticketId),
    subtitle: t.delivery_addr1 || t.project_name || null,
    status: statusLabel,
    plant_name: t.plant_name,
    truck_code: t.truck_code,
    printed_stamp: fmtDateTimeUpper(t.printed_time),
    products,
    events,
  };
}

/* ------------------------------------------------------------------ */
/*  6. Customer (job-site) delay breakdown — one card per load        */
/* ------------------------------------------------------------------ */

export async function getDoleseCustomerDelay(orderId: number): Promise<DoleseCustomerDelay | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, order_code, order_date, customer_name, delivery_addr1, project_name")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseCustomerDelay:", error.message);
    return null;
  }

  const { data: tix } = await supabase
    .from("tickets")
    .select(TICKET_FIELDS)
    .eq("order_id", orderId)
    .limit(500);
  const tickets = ((tix || []) as TicketRow[]).filter(isValidTicket);

  // Standard allowed on-site time per load (the live app shows a flat 30 min plan).
  const PLAN = 30;

  const loads: DoleseDelayLoad[] = tickets
    .filter((t) => has(t.on_job_time))
    .map((t) => {
      const leave = t.wash_time || t.to_plant_time || t.end_unload || t.at_plant_time;
      // delay = customer wait before pouring starts; actual = total time on site.
      const delay = diffMin(t.unload_time, t.on_job_time);
      const actual = diffMin(leave, t.on_job_time);
      return {
        ticket_id: t.ticket_id,
        ticket_code: t.ticket_code,
        plan_min: PLAN,
        delay_min: Math.max(0, delay ?? 0),
        actual_min: Math.max(0, actual ?? 0),
      };
    })
    .sort((a, b) => (a.ticket_code || "").localeCompare(b.ticket_code || ""));

  const d = new Date(order.order_date);
  const md = Number.isNaN(d.getTime()) ? "" : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    customer_name: order.customer_name,
    order_line: `ORDER ${order.order_code}${md ? `-${md}` : ""}`,
    address_line: order.delivery_addr1 || order.project_name || null,
    loads,
  };
}

/* ------------------------------------------------------------------ */
/*  7. Rollout — customer invite search + customer user list          */
/* ------------------------------------------------------------------ */

export interface RolloutCustomerItem {
  id: number;
  code: string | null;
  name: string | null;
  user_count: number;
}

export interface RolloutUser {
  id: string;
  full_name: string | null;
  email: string | null;
  last_login: string | null;
}

export interface RolloutCustomerDetail {
  id: number;
  code: string | null;
  name: string | null;
  users: RolloutUser[];
}

/** Customer search for the Rollout invite flow (by company name or code). */
export async function searchRolloutCustomers(q: string): Promise<RolloutCustomerItem[]> {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();
  if (!term) return [];

  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: custs, error } = await supabase
    .from("customers")
    .select("id, code, name")
    .or(`name.ilike.%${term}%,code.ilike.%${term}%`)
    .order("name", { ascending: true })
    .limit(60);
  if (error) {
    console.error("[ERROR] searchRolloutCustomers:", error.message);
    return [];
  }

  const ids = (custs || []).map((c) => c.id);
  const counts = new Map<number, number>();
  if (ids.length) {
    const { data: links } = await supabase
      .from("user_customers")
      .select("customer_id")
      .in("customer_id", ids)
      .limit(5000);
    for (const l of links || []) counts.set(l.customer_id, (counts.get(l.customer_id) || 0) + 1);
  }

  return (custs || []).map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    user_count: counts.get(c.id) || 0,
  }));
}

/** A customer with its invited app users (for the Rollout customer-detail page). */
export async function getRolloutCustomer(customerId: number): Promise<RolloutCustomerDetail | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: c, error } = await supabase
    .from("customers")
    .select("id, code, name")
    .eq("id", customerId)
    .limit(1)
    .maybeSingle();
  if (error || !c) {
    if (error) console.error("[ERROR] getRolloutCustomer:", error.message);
    return null;
  }

  const { data: links } = await supabase
    .from("user_customers")
    .select("user_id")
    .eq("customer_id", customerId)
    .limit(2000);
  const ids = (links || []).map((l) => l.user_id);

  let users: RolloutUser[] = [];
  if (ids.length) {
    const { data: us } = await supabase
      .from("users")
      .select("id, full_name, email, last_login_at")
      .in("id", ids)
      .limit(2000);
    users = (us || []).map((u) => ({
      id: u.id,
      full_name: u.full_name,
      email: u.email,
      last_login: u.last_login_at,
    }));
    users.sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));
  }

  return { id: c.id, code: c.code, name: c.name, users };
}

/* ------------------------------------------------------------------ */
/*  8. Rollout — single user detail (action grid)                     */
/* ------------------------------------------------------------------ */

export interface RolloutUserDetail {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  customer_name: string | null;
  reinvited_date: string | null;
  forced_logout: boolean;
}

export async function getRolloutUser(userId: string): Promise<RolloutUserDetail | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: u, error } = await supabase
    .from("users")
    .select("id, full_name, email, phone_number, invitation_sent_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !u) {
    if (error) console.error("[ERROR] getRolloutUser:", error.message);
    return null;
  }

  // Primary customer (first assignment) for the "INVITE MORE FROM …" tile.
  let customer_name: string | null = null;
  const { data: link } = await supabase
    .from("user_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (link?.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("name")
      .eq("id", link.customer_id)
      .maybeSingle();
    customer_name = c?.name ?? null;
  }

  const d = u.invitation_sent_at ? new Date(u.invitation_sent_at) : null;
  const reinvited_date =
    d && !Number.isNaN(d.getTime()) ? `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}` : null;

  return {
    id: u.id,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone_number,
    customer_name,
    reinvited_date,
    forced_logout: false,
  };
}

/* ------------------------------------------------------------------ */
/*  9. Rollout — user's project assignment table                      */
/* ------------------------------------------------------------------ */

export interface RolloutProjectRow {
  id: number;
  name: string;
  code: string | null;
  owner: string | null;
  customer: string | null;
  assigned: boolean;
}

export interface RolloutUserProjects {
  user_name: string | null;
  customer_name: string | null;
  projects: RolloutProjectRow[];
}

export async function getRolloutUserProjects(userId: string): Promise<RolloutUserProjects | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: u, error } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !u) {
    if (error) console.error("[ERROR] getRolloutUserProjects:", error.message);
    return null;
  }

  const { data: link } = await supabase
    .from("user_customers")
    .select("customer_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const customerId = link?.customer_id;

  let customer_name: string | null = null;
  let projects: RolloutProjectRow[] = [];

  if (customerId) {
    const { data: c } = await supabase
      .from("customers")
      .select("name")
      .eq("id", customerId)
      .maybeSingle();
    customer_name = c?.name ?? null;

    const [{ data: projs }, { data: assigned }] = await Promise.all([
      supabase
        .from("projects")
        .select("id, code, name, customer_name")
        .eq("customer_id", customerId)
        .order("name", { ascending: true })
        .limit(1000),
      supabase.from("user_projects").select("project_id").eq("user_id", userId).limit(2000),
    ]);

    const assignedSet = new Set((assigned || []).map((a) => a.project_id));
    projects = (projs || []).map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      owner: p.customer_name,
      customer: p.customer_name,
      assigned: assignedSet.has(p.id),
    }));
  }

  return { user_name: u.full_name, customer_name, projects };
}

/* ------------------------------------------------------------------ */
/*  10. Order Request — project search (order by project)             */
/* ------------------------------------------------------------------ */

export interface OrderProjectCard {
  project_id: number;
  project_name: string;
  project_code: string | null;
  customer_name: string | null;
  customer_code: string | null;
  recent_orders: number;
}

export interface OrderProjectSearch {
  customers: { id: number; name: string | null; code: string | null }[];
  projects: OrderProjectCard[];
}

export async function searchOrderProjects(q: string): Promise<OrderProjectSearch> {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();
  if (!term) return { customers: [], projects: [] };

  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data: custs, error } = await supabase
    .from("customers")
    .select("id, code, name")
    .or(`name.ilike.%${term}%,code.ilike.%${term}%`)
    .order("name", { ascending: true })
    .limit(20);
  if (error) {
    console.error("[ERROR] searchOrderProjects:", error.message);
    return { customers: [], projects: [] };
  }
  const custIds = (custs || []).map((c) => c.id);
  if (!custIds.length) return { customers: [], projects: [] };

  const { data: projs } = await supabase
    .from("projects")
    .select("id, code, name, customer_name, customer_code")
    .in("customer_id", custIds)
    .order("name", { ascending: true })
    .limit(500);

  const projIds = (projs || []).map((p) => p.id);
  const counts = new Map<number, number>();
  if (projIds.length) {
    const { data: ords } = await supabase
      .from("orders")
      .select("project_id")
      .in("project_id", projIds)
      .limit(20000);
    for (const o of ords || []) {
      if (o.project_id != null) counts.set(o.project_id, (counts.get(o.project_id) || 0) + 1);
    }
  }

  const projects: OrderProjectCard[] = (projs || []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    project_code: p.code,
    customer_name: p.customer_name,
    customer_code: p.customer_code,
    recent_orders: counts.get(p.id) || 0,
  }));

  return {
    customers: (custs || []).map((c) => ({ id: c.id, name: c.name, code: c.code })),
    projects,
  };
}

/** Minimal project lookup to prefill the Order Request Form. */
export async function getProjectBasic(
  projectId: number,
): Promise<{ name: string; customer_name: string | null } | null> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const { data } = await supabase
    .from("projects")
    .select("name, customer_name")
    .eq("id", projectId)
    .maybeSingle();
  return data ? { name: data.name, customer_name: data.customer_name } : null;
}

/** Get all projects for the Order By Project page (no search required). */
export async function getAllProjects(): Promise<OrderProjectCard[]> {
  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  // Get all active projects ordered by customer name then project name
  const { data: projs, error } = await supabase
    .from("projects")
    .select("id, code, name, customer_name, customer_code")
    .order("customer_name", { ascending: true })
    .order("name", { ascending: true })
    .limit(500);

  if (error) {
    console.error("[ERROR] getAllProjects:", error.message);
    return [];
  }

  return (projs || []).map((p) => ({
    project_id: p.id,
    project_name: p.name,
    project_code: p.code,
    customer_name: p.customer_name,
    customer_code: p.customer_code,
    recent_orders: 0, // Not counting orders for performance
  }));
}

/* ------------------------------------------------------------------ */
/*  Company Search (for Projects -> Company page)                      */
/* ------------------------------------------------------------------ */

export interface CompanySearchResult {
  id: number;
  name: string | null;
  code: string | null;
  project_count: number;
  user_count: number;
}

export async function searchCompanies(q: string): Promise<CompanySearchResult[]> {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();
  if (!term) return [];

  const supabase = await getSupabaseClient();

  const { data: custs, error } = await supabase
    .from("customers")
    .select("id, code, name")
    .or(`name.ilike.%${term}%,code.ilike.%${term}%`)
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[ERROR] searchCompanies:", error.message);
    return [];
  }

  if (!custs || custs.length === 0) return [];

  // Get project counts for each customer
  const custIds = custs.map((c) => c.id);
  const { data: projCounts } = await supabase
    .from("projects")
    .select("customer_id")
    .in("customer_id", custIds);

  const projectCountMap = new Map<number, number>();
  for (const p of projCounts || []) {
    if (p.customer_id != null) {
      projectCountMap.set(p.customer_id, (projectCountMap.get(p.customer_id) || 0) + 1);
    }
  }

  return custs.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    project_count: projectCountMap.get(c.id) || 0,
    user_count: 15, // Placeholder - would need user_customers table query
  }));
}

/* ------------------------------------------------------------------ */
/*  Project Search (for Projects -> Project page)                      */
/* ------------------------------------------------------------------ */

export interface ProjectSearchResult {
  id: number;
  name: string | null;
  code: string | null;
  customer_name: string | null;
  user_count: number;
}

export async function searchProjectsByName(q: string): Promise<ProjectSearchResult[]> {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();
  if (!term) return [];

  const supabase = await getSupabaseClient();

  const { data: projs, error } = await supabase
    .from("projects")
    .select("id, code, name, customer_name")
    .or(`name.ilike.%${term}%,customer_name.ilike.%${term}%`)
    .order("name", { ascending: true })
    .limit(50);

  if (error) {
    console.error("[ERROR] searchProjectsByName:", error.message);
    return [];
  }

  return (projs || []).map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    customer_name: p.customer_name,
    user_count: 15, // Placeholder
  }));
}

/* ------------------------------------------------------------------ */
/*  Order Requests (for Order Request Dashboard)                       */
/* ------------------------------------------------------------------ */

export interface OrderRequestItem {
  order_id: number | string;
  order_code: string;
  order_date: string;
  start_time: string | null;
  ordered_cy: number;
  address: string | null;
  customer_name: string | null;
  status: "active" | "scheduled";
}

export async function getOrderRequests(): Promise<OrderRequestItem[]> {
  const supabase = await getSupabaseClient();

  // Get today's orders only
  const today = new Date().toISOString().slice(0, 10);

  const { data: orders, error } = await supabase
    .from("orders")
    .select(
      "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products(order_qty, order_qty_unit, is_mix, order_product_schedules(start_time))"
    )
    .eq("order_date", today)
    .order("order_code", { ascending: true })
    .limit(100);

  if (error) {
    console.error("[ERROR] getOrderRequests:", error.message);
    return [];
  }

  if (!orders) return [];

  return orders.map((o) => {
    // Calculate ordered CY
    const products = (o.order_products || []) as {
      order_qty: number | null;
      order_qty_unit: string | null;
      is_mix: boolean | null;
      order_product_schedules?: { start_time: string | null }[];
    }[];

    let orderedCY = 0;
    let startTime: string | null = null;

    for (const p of products) {
      if (p.is_mix && p.order_qty_unit === "CY") {
        orderedCY += p.order_qty || 0;
      }
      // Get earliest start time
      for (const s of p.order_product_schedules || []) {
        if (s.start_time && (!startTime || s.start_time < startTime)) {
          startTime = s.start_time;
        }
      }
    }

    // Determine status: active (in process) or scheduled (pre-pour)
    const currentStatus = o.current_status as number | null;
    const isRemoved = o.removed === true;
    const hasStarted = currentStatus !== null && currentStatus > 0;

    // Format start time
    let formattedTime = "";
    if (startTime) {
      const d = new Date(startTime);
      const month = d.getUTCMonth() + 1;
      const day = d.getUTCDate();
      const hours = String(d.getUTCHours()).padStart(2, "0");
      const minutes = String(d.getUTCMinutes()).padStart(2, "0");
      formattedTime = `${month}/${day} ${hours}:${minutes}`;
    }

    return {
      order_id: o.order_id,
      order_code: o.order_code || "",
      order_date: o.order_date,
      start_time: formattedTime || null,
      ordered_cy: Math.round(orderedCY * 100) / 100,
      address: o.delivery_addr1 || o.project_name || null,
      customer_name: o.customer_name || null,
      status: (hasStarted && !isRemoved ? "active" : "scheduled") as "active" | "scheduled",
    };
  });
}
