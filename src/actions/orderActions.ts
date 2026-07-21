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
import orderSequences from "@/data/dolese-order-sequence.json";
import { getExcludedPatterns } from "@/actions/exclusionActions";
import { filterExcludedOrders } from "@/lib/order-filters";
import { getTenantSupabaseClient, getSelectedTenant, getSelectedTenantDisplayName } from "@/actions/tenantActions";
import { SupabaseClient } from "@supabase/supabase-js";
import { getPgAdapterClient } from "@/supabase/pg-adapter";

// Helper to get the appropriate Supabase client (tenant-specific or default)
async function getSupabaseClient(): Promise<SupabaseClient> {
  // The new Dolese Postgres cluster (DOLESE_PG_URL) takes precedence over the
  // per-tenant Supabase lookup — the orders data now lives there.
  const pg = getPgAdapterClient();
  if (pg) return pg as unknown as SupabaseClient;

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
  /** Dispatch label (Firm / W/C / Hold / Cancelled …) — drives PRE-POUR card colour. */
  dispatch_status: string;
  /** Poured speed as a % of planned speed (0–100+), or null. Drives IN_PROCESS/COMPLETE colour. */
  pour_pct: number | null;
  /** Total CY delivered so far — drives the IN_PROCESS pie fill (poured ÷ ordered). */
  poured_cy: number;
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
  /** Raw scheduled start (CST-clock in a UTC field) — drives the Pre-Pour ON JOB tile. */
  scheduled_time_raw: string | null;
  /** Requested delivery rate CY/HR (order_product_schedules.delivery_rate_per_hour) —
   *  the Pre-Pour RATE tile. Null when the order has no scheduled rate. */
  delivery_rate: number | null;
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
  /** Customer delay (COMPLETE spec): on-site time beyond the allotted pour, minutes. */
  customer_delay_min: number;
  /** Per-load delay breakdown (D3 "Delay Overview" + "Delay Details"), arrival order. */
  delay_loads: {
    order: number;
    ticket: string;
    ticket_id: string;
    truck: string;
    planned_on_job: string;
    actual_on_job: string;
    prod_delay: number;
    begin_pour: string;
    end_pour: string;
    scheduled_end_pour: string;
    spacing: number;
    wait_to_pour: number;
    pour_min_over: number;
    contractor_delay: number;
    plus_load: string;
  }[];
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
    // ts = raw CST-clock timestamp for the point; drives the tooltip's "Weekday, Mon D, HH:MM:SS" header.
    orderedPoints: { t: number; v: number; ts?: string }[]; // Points at each scheduled truck arrival
    delivered: { t: number; v: number; ts?: string }[]; // Delivered rate (CY/HR) at each arrival
    poured: { t: number; v: number; ts?: string }[]; // Poured rate (CY/HR) at each pour completion
    trucks: { t: number; waiting: number; pouring: number; ts?: string }[];
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
  order_date: string;
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

export interface DoleseProducerDelayLoad {
  ticket_id: number;
  ticket_code: string | null;
  truck_code: string | null;
  /** Scheduled on-job time ("DUE"), clock HH:MM[:SS]. */
  due: string;
  /** Actual on-job time ("ARRIVED"), clock HH:MM[:SS]. */
  arrived: string;
  /** Producer (plant) lateness minutes for this load = Prod Delay. */
  delay_min: number;
}

export interface DoleseProducerDelay {
  order_id: number;
  order_code: string;
  order_line: string | null;
  address_line: string | null;
  loads: DoleseProducerDelayLoad[];
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
  badge?: string;
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

/**
 * Order status per the D3 ORDER HELP spec:
 *   - Cancelled  → order was removed for any reason.
 *   - Pre-Pour   → no ticket activity yet.
 *   - In Process → has some ticket activity.
 *   - Complete   → "has poured the ordered amount" (poured volume ≥ ordered).
 * Note: completion is driven by the POURED volume reaching the order — NOT by the
 * dispatch `current_status` flag (D3 keeps a dispatch-closed order In Process until
 * the concrete is actually poured) and NOT merely by all loads being ticketed.
 */
function deriveStatus(
  order: { current_status: number | string | null; removed: boolean | null; remove_reason_code: string | null },
  orderedCY: number,
  pouredCY: number,
  hasActivity: boolean,
): OrderStatus {
  if (order.removed === true && (order.remove_reason_code || "").trim() !== "") return "CANCELED";
  if (hasActivity || pouredCY > 0) {
    // Live loads / pour in progress → completion is POURED-based, NOT the dispatch flag:
    // D3 keeps a dispatch-closed order In Process until the concrete is actually poured
    // (e.g. 26602 has current_status = 4 yet is still pouring → stays In Process).
    if (areAllLoadsTicketed(orderedCY, pouredCY)) return "COMPLETED"; // poured ≥ ordered (±0.02)
    return "IN_PROCESS";
  }
  // No live loads in our data. A dispatch-closed order (current_status = 4) whose ticket
  // rows were removed after it finished is Completed (e.g. 40501, which D3 shows as
  // Completed); otherwise it simply hasn't started. Coerce — current_status can arrive as
  // the string "4", so strict === 4 would miss it.
  if (Number(order.current_status) === 4) return "COMPLETED";
  return "PRE_POUR";
}

/**
 * Map dispatch `current_status` code to the D3 production label.
 * Verified by joining our per-order current_status to the colours D3 assigned in
 * the exported JobsForFixedNodeID.htm (Firm→green, Will-Call→yellow, Hold→red):
 *   0 → Firm (green)    e.g. 40501, 48107, 25507 — all GREEN in D3
 *   1 → W/C  (yellow)   e.g. 48307, 20301, 24303 — all YELLOW in D3
 *   3 → Hold (red)      e.g. 22702, 22501        — both ON HOLD/RED in D3
 * (An earlier mapping had 0/1/3 shifted, which reddened ~116 firm orders.)
 */
const DISPATCH_STATUS_LABELS: Record<number, string> = {
  0: "Firm",
  1: "W/C",
  2: "Active",
  3: "Hold",
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
  scheduled_on_job_time: string | null;
  unload_time: string | null;
  wash_time: string | null;
  to_plant_time: string | null;
  at_plant_time: string | null;
  end_unload: string | null;
  remove_reason_code: string | null;
}

const TICKET_FIELDS =
  "ticket_id, ticket_code, truck_code, printed_time, load_time, loaded_time, to_job_time, on_job_time, scheduled_on_job_time, unload_time, wash_time, to_plant_time, at_plant_time, end_unload, remove_reason_code";

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
  { field: "printed_time", label: "TICKETED" },
  { field: "load_time", label: "LOADING" },
  { field: "loaded_time", label: "LOADED" },
  { field: "to_job_time", label: "TO JOB" },
  { field: "on_job_time", label: "AT JOB" },
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

// "Now", expressed the way ticket/GPS stamps are stored — the America/Chicago wall clock
// placed in a UTC field (so its UTC parts read as the local clock). Lets us compare against
// tickets.* and trucks.location_update_time, which use that same convention, and feed the
// result back through fmtTime (which reads UTC parts). Used to gauge GPS-fix staleness and
// to floor a live ETA at the present moment.
function nowInCstClockMs(): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour"); // some ICU builds emit 24 at midnight
  return Date.parse(`${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}:${g("second")}Z`);
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

/** "Jul 17 @ 12:24PM CST" for a REAL UTC timestamptz (order_notes.note_date), converted
 *  to America/Chicago — unlike ticket times, note_date is a genuine tz-aware instant. */
function fmtNoteStamp(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
  return `${g("month")} ${g("day")} @ ${g("hour")}:${g("minute")}${g("dayPeriod").toUpperCase()} CST`;
}

/** A REAL tz-aware instant (note_date / order_change_logs.changed_at) expressed on the SAME
 *  basis as ticket times — the America/Chicago wall clock placed in a UTC epoch — so the
 *  activity feed can sort change events, notes and (CST-clock-in-UTC) truck messages together
 *  in one newest→oldest order like D3's Social Stream. */
function realInstantToCstClockMs(ts: string | null): number | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hh = g("hour") === "24" ? "00" : g("hour");
  return Date.parse(`${g("year")}-${g("month")}-${g("day")}T${hh}:${g("minute")}:${g("second")}Z`);
}

// D3's Social-Stream short status names for current_status change events (numeric code →
// label). Note these differ from the dispatch-board labels stored as *_display_value
// ("Normal"/"Will Call") — D3's feed reads status 0 as "Firm", 4 as "Comp".
const D3_FEED_STATUS: Record<string, string> = {
  "0": "Firm", "1": "W/C", "2": "Active", "3": "Hold", "4": "Comp", "5": "Cancelled",
};
// Concrete volume shown to the half-yard, like D3 ("52.51" → "52.50").
const halfYardLabel = (n: number) => (Math.round(n * 2) / 2).toFixed(2);

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

// Map an OpenWeatherMap icon code (e.g. "01n", "04d") to a glyph we ship in Order_files.
// The full OWM day+night set (01d…50n) is now vendored from D3, so the code maps 1:1.
function owmGlyph(code: string | undefined): string | undefined {
  if (!code) return undefined;
  const m = String(code).match(/^(0[1-9]|1[013]|50)([dn])$/i);
  return m ? m[1] + m[2].toLowerCase() : undefined;
}

// Map a WeatherAPI icon URL (…/day/113.png) to the matching OWM-coded D3 glyph (day/night
// + condition), so the stored WeatherAPI weather renders D3's own weather icon.
function weatherApiGlyph(iconUrl: string): string | undefined {
  const m = iconUrl.match(/\/(day|night)\/(\d+)\.png/i);
  if (!m) return undefined;
  const dn = m[1].toLowerCase() === "day" ? "d" : "n";
  const CODE: Record<string, string> = {
    "113": "01", "116": "02", "119": "03", "122": "04", "143": "50", "248": "50", "260": "50",
    "176": "10", "293": "10", "296": "10", "299": "10", "302": "10", "305": "10", "308": "10", "356": "10", "359": "10",
    "263": "09", "266": "09", "281": "09", "284": "09", "311": "09", "314": "09", "353": "09",
    "200": "11", "386": "11", "389": "11", "392": "11", "395": "11",
    "179": "13", "182": "13", "185": "13", "227": "13", "230": "13", "317": "13", "320": "13", "323": "13",
    "326": "13", "329": "13", "332": "13", "335": "13", "338": "13", "350": "13", "362": "13", "365": "13",
    "368": "13", "371": "13", "374": "13", "377": "13",
  };
  return (CODE[m[2]] || "04") + dn;
}

// Live current weather from OpenWeatherMap at a lat/lng. Returns an OWM-shaped object
// (main.temp, wind.speed/deg, weather[].description/icon, dt) that the order-detail
// weather parser already understands. Null on failure so the caller falls back to the
// stored weather_data JSONB. Short timeout so a slow API never stalls the page.
async function fetchOWMWeather(lat: number, lng: number, key: string): Promise<Record<string, unknown> | null> {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=imperial&appid=${key}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    return j && (j.main || j.weather) ? j : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  1. Market summary (business-unit aggregate)                        */
/* ------------------------------------------------------------------ */

export async function getDoleseSummary(dateStr: string, dateToStr?: string): Promise<DoleseSummary> {
  // Support date ranges: if dateToStr is provided, query from dateStr to dateToStr (inclusive)
  const from = dateStr;
  const to = dateToStr ? dayRange(dateToStr).to : dayRange(dateStr).to;

  // Get tenant-specific Supabase client and selected tenant name
  const [supabase, selectedTenant, exclusionPatterns, tenantDisplayName] = await Promise.all([
    getSupabaseClient(),
    getSelectedTenant(),
    getExcludedPatterns(),
    getSelectedTenantDisplayName(),
  ]);

  // Use the D3 display name (short name like "DOLESE" instead of "Dolese Ready Mix")
  const tenantName = tenantDisplayName || selectedTenant || "DOLESE";

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

export async function getDoleseOrders(dateStr: string, dateToStr?: string): Promise<DoleseOrderListItem[]> {
  // Support date ranges: with dateToStr the window runs from dateStr through the END of
  // dateToStr (inclusive), else it's the single day. Mirrors getDoleseSummary.
  const { from } = dayRange(dateStr);
  const to = dateToStr ? dayRange(dateToStr).to : dayRange(dateStr).to;

  // Get tenant-specific Supabase client first
  const supabase = await getSupabaseClient();

  // Fetch orders and exclusion patterns in parallel
  const [ordersResult, exclusionPatterns] = await Promise.all([
    supabase
      .from("orders")
      .select(
        "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products!inner(order_qty, order_qty_unit, delv_qty, is_mix, item_code, order_product_schedules(start_time, delivery_rate_per_hour))",
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

  // Map to DoleseOrderListItem, only including filtered orders. Also capture each order's
  // planned delivery rate (CY/HR) so we can later compute the poured-speed %.
  const plannedByOrder = new Map<number, number>();
  // Keep each order's raw dispatch status + ordered CY so we can re-derive the
  // list status from actual ticket activity below.
  const metaByOrder = new Map<number, { cs: number | null; ordered: number }>();
  const items: DoleseOrderListItem[] = cyOrders
    .filter((o) => filteredIds.has(o.order_id))
    .map((o) => {
      const products = (o.order_products || []) as (OrderProductRow & {
        order_product_schedules?: { start_time: string | null; delivery_rate_per_hour?: number | null }[];
      })[];
      const { ordered, ticketed } = sumCY(products);
      const planned = products
        .flatMap((p) => p.order_product_schedules || [])
        .find((s) => s?.delivery_rate_per_hour != null)?.delivery_rate_per_hour;
      if (planned != null) plannedByOrder.set(Number(o.order_id), Number(planned));
      metaByOrder.set(Number(o.order_id), {
        cs: (o as { current_status: number | null }).current_status,
        ordered,
      });
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
        // First-pass status from order_products only (no poured volume yet): Pre-Pour
        // if nothing delivered, else In Process. The ticket pass below refines it and
        // decides Completion from the actual poured volume.
        status: deriveStatus(o, ordered, 0, ticketed > 0),
        dispatch_status: getDispatchStatus(o.current_status, o.removed, o.remove_reason_code),
        pour_pct: null as number | null,
        poured_cy: 0,
      };
    });

  // Status + poured-speed from ACTUAL ticket activity. D3 defines "In Process" as
  // "an order that has some ticket activity", so we must look at tickets — the
  // order_products.delv_qty used above is often stale (0) even when trucks have
  // run, which wrongly leaves started orders as Pre-Pour. Batch-fetch tickets for
  // EVERY order in the day (not just the ones delv_qty already flagged active).
  const allIds = items.map((i) => Number(i.order_id));
  if (allIds.length > 0) {
    // Supabase/PostgREST caps EVERY response at its `max-rows` limit (1000 here); a bare
    // `.limit(10000)`/`.limit(40000)` does NOT override it — it silently returns only the
    // first 1000 rows. A busy day has far more tickets + ticket_products than that (07-17 had
    // 2,432 products), so the tail loads of each order were dropped, undercounting poured
    // volume and freezing FINISHED orders as "In Process" (e.g. 48107 read 346.5/357 → IN
    // PROCESS on the board while the detail page correctly showed 357 → COMPLETED). Paginate:
    // tickets by keyset range (ordered by the unique ticket_id), products by batching the
    // ticket-id list so each request stays under the cap.
    const tickets: (TicketRow & { order_id: number })[] = [];
    for (let from = 0; ; from += 1000) {
      const { data: tix } = await supabase
        .from("tickets")
        .select(`${TICKET_FIELDS}, order_id`)
        .in("order_id", allIds)
        .order("ticket_id")
        .range(from, from + 999);
      const rows = (tix || []) as (TicketRow & { order_id: number })[];
      for (const t of rows) if (isValidTicket(t)) tickets.push(t);
      if (rows.length < 1000) break;
    }

    const cyByTicket = new Map<number, number>();
    if (tickets.length > 0) {
      const tids = tickets.map((t) => t.ticket_id);
      // ≤200 ticket ids per request keeps each response (≤~4 products/ticket) under the cap.
      for (let i = 0; i < tids.length; i += 200) {
        const { data: tp } = await supabase
          .from("ticket_products")
          .select("ticket_id, is_mix, load_qty, order_qty_unit")
          .in("ticket_id", tids.slice(i, i + 200));
        for (const p of tp || []) {
          if (p.is_mix === true && isCubicYardUnit(p.order_qty_unit)) {
            cyByTicket.set(p.ticket_id, (cyByTicket.get(p.ticket_id) || 0) + Number(p.load_qty || 0));
          }
        }
      }
    }

    const tByOrder = new Map<number, (TicketRow & { order_id: number })[]>();
    for (const t of tickets) {
      const arr = tByOrder.get(t.order_id) ?? [];
      arr.push(t);
      tByOrder.set(t.order_id, arr);
    }
    const minOf = (ts: string | null): number | null => {
      if (!ts) return null;
      const d = new Date(ts);
      return Number.isNaN(d.getTime()) ? null : d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    };
    for (const it of items) {
      if (it.status === "CANCELED") continue; // cancelled stays cancelled
      const ot = tByOrder.get(Number(it.order_id)) || [];
      if (ot.length === 0) {
        // No ticket activity ⇒ NOT started (D3: "In Process = has ticket activity").
        // order_products.delv_qty can be non-zero with zero tickets, so don't let it mark
        // the order In-Process — re-derive via deriveStatus (Pre-Pour, or Completed if
        // dispatch closed it). Same code path as the detail page, so they stay consistent.
        const m = metaByOrder.get(Number(it.order_id));
        it.status = deriveStatus(
          { current_status: m?.cs ?? null, removed: false, remove_reason_code: null },
          m?.ordered ?? it.ordered_cy,
          0,
          false,
        );
        it.ticketed_cy = 0;
        it.poured_cy = 0;
        it.pour_pct = null;
        continue;
      }

      let delivered = 0; // CY on all valid tickets (ticketed / delivered)
      let pouredVol = 0; // CY that has POURED OUT — drives the pie, completion AND pour speed
      // Pour window (for the speed %) is measured only over loads that have poured out —
      // each load's pour start (unload) to its pour finish — so the poured VOLUME and the
      // window come from the SAME loads. Using end_unload/wash alone undercounted the
      // volume (loads with only at-plant/to-plant stamps were dropped), which halved the
      // speed and wrongly reddened tiles D3 shows yellow/green.
      const starts: number[] = [];
      const ends: number[] = [];
      for (const t of ot) {
        const cy = cyByTicket.get(t.ticket_id) || 0;
        delivered += cy;
        if (isPouredOut(t)) {
          pouredVol += cy;
          const ps = minOf(t.unload_time);
          const pe = minOf(t.end_unload || t.wash_time || t.at_plant_time || t.to_plant_time);
          if (ps != null) starts.push(ps);
          if (pe != null) ends.push(pe);
        }
      }

      // Re-derive status from real ticket activity (has tickets ⇒ at least In Process;
      // Complete once the FINISHED-load volume reaches the ordered amount). We use the
      // completed volume (poured-out OR long-idle loads), not just poured-out: a small
      // order whose only load is on the job but never got a pour-out stamp (e.g. 21804)
      // is Complete, while an order still actively pouring (e.g. 26602: 105 delivered but
      // only 32 poured) stays In Process.
      // Completion = POURED-OUT volume ≥ ordered. An order still actively pouring (26602:
      // 32 of 105 poured) stays In Process. We can't complete an order whose last load has
      // no pour-out stamp (same signature as one still pouring) — that needs the stamp our
      // snapshot sometimes lacks (e.g. 21804 reads In Process here vs Complete in D3).
      const meta = metaByOrder.get(Number(it.order_id));
      it.status = deriveStatus(
        { current_status: meta?.cs ?? null, removed: false, remove_reason_code: null },
        meta?.ordered ?? it.ordered_cy,
        pouredVol,
        true,
      );
      // D3 completes a dispatch-CLOSED order (current_status = 4) once every DELIVERED load has
      // poured out — even when the delivered total fell short of the ORIGINAL order because the
      // remaining loads were cancelled (e.g. 26404: ordered 84, only 14.5 ticketed+poured, dispatch
      // closed → D3 shows "14.5 COMPLETE"). Our poured≥ordered rule wrongly held these In Process.
      // `delivered`/`pouredVol` are over VALID (non-removed) tickets, so the cancelled tail isn't
      // counted; a dispatch-closed order still actively pouring (pouredVol < delivered — a truck on
      // the job, e.g. 48107 mid-pour) correctly stays In Process, matching D3.
      if (it.status === "IN_PROCESS" && Number(meta?.cs) === 4 && delivered > 0 && pouredVol >= delivered - 0.02) {
        it.status = "COMPLETED";
      }
      // Ticket-based delivered is authoritative for the ticketed figure.
      it.ticketed_cy = Math.max(it.ticketed_cy, Math.round(delivered * 100) / 100);
      // Pie fill = volume POURED-OUT ÷ volume ordered — verified against the D3 export's own
      // pie values (e.g. 40502 = 66% poured / 34% remaining), which track the stamped
      // poured-out volume, NOT delivered and NOT a recovered estimate (recovery over-counted
      // vs D3, e.g. reading 88% when D3 showed ~66%).
      it.poured_cy = Math.round(pouredVol * 100) / 100;
      const planned = plannedByOrder.get(Number(it.order_id));
      if (starts.length && pouredVol > 0 && planned && planned > 0) {
        // Poured-speed % (drives the tile colour per the D3 JOBS HELP) = the concrete
        // actually poured ÷ the time it took, as a % of the planned delivery rate:
        //     pour_pct = (pouredVol / pourHours) / plannedRate * 100
        // The window is the real pouring span — first pour start to last pour finish (or,
        // for a single load, its own discharge). A short floor stops a couple of near-
        // instant discharge stamps from spiking the rate into the thousands of percent.
        const firstStart = Math.min(...starts);
        const lastEnd = ends.length ? Math.max(...ends) : Math.max(...starts);
        const durMin = Math.max(lastEnd - firstStart, 6);
        it.pour_pct = Math.round(((pouredVol / (durMin / 60)) / planned) * 100);
      }
    }
  }

  // Board order: In-Process first, then Completed, then Upcoming (Pre-Pour / On-Hold),
  // then Cancelled at the very bottom.
  //   Group 0 — In Process
  //   Group 1 — Completed
  //   Group 2 — not-started (Pre-Pour + On Hold)
  //   Group 3 — Cancelled (single trailing block at the very bottom)
  // Within each group, ascending by scheduled start time (untimed / will-call → after
  // all timed orders); the order's internal id breaks ties. Verified against the live D3
  // board: within one time slot the order is NOT by CY and NOT by order_code (both are
  // unsorted) — it follows the entry/id sequence. Colour is a per-tile status cue, not a
  // sort key, so held/behind (red) tiles fall at their own time slot within a group.
  const startMinutes = (t: string | null): number => {
    if (!t) return Number.POSITIVE_INFINITY; // untimed (will-call) → after all timed
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
    return d.getUTCHours() * 60 + d.getUTCMinutes(); // CST clock value stored in a UTC field
  };
  const groupRank = (s: OrderStatus): number => {
    if (s === "IN_PROCESS") return 0; // active pours first
    if (s === "COMPLETED") return 1; // then finished
    if (s === "CANCELED") return 3; // cancelled last
    return 2; // upcoming: pre-pour / on-hold
  };
  // D3's board order is DYNAMIC and status-driven — verified against the export:
  //   1. status group: In-Process first, then Completed, then Pre-Pour/On-Hold, then Cancelled.
  //      (An order that STARTS POURING moves from the pre-pour block up into the in-process
  //       block at the top — this must stay live, so status group is the PRIMARY key.)
  //   2. within a group: ascending by scheduled time.
  //   3. within the same group AND the same minute: D3's dispatch-board sequence, which isn't
  //      derivable from our data (all same-minute orders share an identical timestamp). Where
  //      we have a captured D3 export for this date (src/data/dolese-order-sequence.json) we
  //      replay its relative order as the tie-breaker; else fall back to the internal id.
  // The capture is only a tie-breaker now, so orders re-sort correctly as they start/finish
  // pouring instead of being frozen at the positions they had when the export was taken.
  const capturedSeq = (orderSequences as Record<string, string[]>)[dateStr];
  const rank = capturedSeq && capturedSeq.length ? new Map(capturedSeq.map((code, i) => [code, i])) : null;
  const END = Number.MAX_SAFE_INTEGER;
  items.sort((a, b) => {
    // A captured D3 export for this date is AUTHORITATIVE: it already encodes D3's full board
    // order (status grouping + intra-group dispatch sequence), so replay it verbatim. The
    // status-group + scheduled-time heuristic below can't reproduce D3's intra-group order
    // (same-minute / untimed orders follow D3's dispatch sequence, not derivable from our data),
    // so it's only the fallback for LIVE dates that have no capture (which must re-sort as orders
    // start/finish pouring). Orders absent from the capture (synced after it was taken) trail by id.
    if (rank) {
      const ra = rank.has(String(a.order_code)) ? (rank.get(String(a.order_code)) as number) : END;
      const rb = rank.has(String(b.order_code)) ? (rank.get(String(b.order_code)) as number) : END;
      if (ra !== rb) return ra - rb;
      const ia0 = Number(a.order_id);
      const ib0 = Number(b.order_id);
      if (!Number.isNaN(ia0) && !Number.isNaN(ib0) && ia0 !== ib0) return ia0 - ib0;
      return String(a.order_id).localeCompare(String(b.order_id));
    }
    const g = groupRank(a.status) - groupRank(b.status);
    if (g !== 0) return g;
    const ta = startMinutes(a.start_time);
    const tb = startMinutes(b.start_time);
    if (ta !== tb) return ta - tb;
    const ia = Number(a.order_id);
    const ib = Number(b.order_id);
    if (!Number.isNaN(ia) && !Number.isNaN(ib) && ia !== ib) return ia - ib;
    return String(a.order_id).localeCompare(String(b.order_id));
  });
  return items;
}

export interface DoleseAnnouncement {
  tagline: string | null;
  title: string | null;
  subtitle: string | null;
  color: string | null;
}

/**
 * The current published promo/announcement (e.g. the weekly Fuel Surcharge) — the red
 * tile at the top of the orders + market pages. Returns the one live TODAY (published,
 * with today between start_date/end_date), newest start first, or null if none is active.
 * Driven by the `announcements` table so the tagline/amount update without a code change.
 */
export async function getActiveAnnouncement(): Promise<DoleseAnnouncement | null> {
  const supabase = await getSupabaseClient();
  const today = new Date().toISOString().slice(0, 10);
  // Same filter/order as /api/announcements/active (the market page's source) so the
  // orders + market pages surface the SAME promo tile.
  const { data, error } = await supabase
    .from("announcements")
    .select("tagline, title, subtitle, color, start_date, end_date, is_published, created_at")
    .eq("is_published", true)
    .lte("start_date", today)
    .gte("end_date", today)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error || !data || !data.length) {
    if (error) console.error("[ERROR] getActiveAnnouncement:", error.message);
    return null;
  }
  const a = data[0] as { tagline: string | null; title: string | null; subtitle: string | null; color: string | null };
  return { tagline: a.tagline, title: a.title, subtitle: a.subtitle, color: a.color };
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
  const allSchedules = rawProducts.flatMap((p) => (p.order_product_schedules || []) as ScheduleData[]);
  const firstSchedule = allSchedules.find((s) => s.start_time);
  const spacingMinutes = firstSchedule?.truck_space ?? null;
  const deliveryRatePerHour = firstSchedule?.delivery_rate_per_hour ?? null;
  const numberOfLoads = firstSchedule?.number_of_loads ?? null;

  // An order can carry MULTIPLE schedule "waves" for its mix — D3 splits a pour into
  // streams (e.g. 24304: a 03:00/1-load stream + a 03:45/11-load stream, both 42 CY/HR).
  // The per-load delay/finish math uses the per-wave rate + spacing above (which matches
  // D3's delay tiles), but the chart's "Ordered" reference line is the COMBINED requested
  // throughput across all waves: D3 shows 84 = 42 + 42, drawn across all 12 loads. Sum the
  // waves for the chart only (a single-wave order reduces to the same single rate/count).
  const chartOrderedRate =
    allSchedules.reduce((s, sc) => s + (Number(sc.delivery_rate_per_hour) || 0), 0) || (deliveryRatePerHour ?? 0);
  const totalScheduledLoads =
    allSchedules.reduce((s, sc) => s + (Number(sc.number_of_loads) || 0), 0) || (numberOfLoads ?? 0);

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

  // Prefer the plants-table full description ("Moore Batch Plant") over the ticket's
  // short plant_name ("Moore") — D3 shows the full plant name on the weather tile.
  const plantCode = firstTicket?.plant_code || firstSchedule?.plant_code || order.pricing_plant_code;
  let plantLat: number | null = null;
  let plantLng: number | null = null;
  if (plantCode) {
    const { data: plant } = await supabase
      .from("plants")
      .select("description, short_description, latitude, longitude")
      .eq("code", plantCode)
      .maybeSingle();
    plantName = plant?.description || plant?.short_description || null;
    if (plant?.latitude != null && plant?.longitude != null) {
      plantLat = Number(plant.latitude);
      plantLng = Number(plant.longitude);
    }
  }
  if (!plantName) plantName = firstTicket?.plant_name || null;

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

  // TRUCKS tile = trucks currently "on the map": assigned to this order and not yet
  // BACK at the plant. A truck counts from the moment it has a ticket printed
  // (TICKETED) — through Loaded, To Job, On Job, Pouring and even driving back
  // (To Plant) — and only drops off once it has actually arrived at the plant
  // (at_plant_time). We retire it at at_plant (not to_plant) because a truck driving
  // back is still on the road / on the map.
  const mapTickets = tickets.filter(
    (t) => has(t.printed_time) && !has(t.at_plant_time),
  );
  const trucks = new Set(mapTickets.map((t) => t.truck_code).filter(Boolean)).size;

  // Calculate actual ticketed CY from ticket_products (sum of all delivered loads)
  // This is more accurate than order_products.delv_qty which may not be updated
  let actualTicketedCY = 0;
  for (const cy of cyByTicket.values()) {
    actualTicketedCY += cy;
  }

  // ON JOB = "total concrete that has ARRIVED at the jobsite" (D3 ORDER HELP).
  // Every ticket that reached the job (on_job_time set) counts — do NOT subtract
  // trucks that have since left; their concrete is poured/on the job.
  const onJobCY = tickets
    .filter((t) => has(t.on_job_time))
    .reduce((s, t) => s + (cyByTicket.get(t.ticket_id) || 0), 0);

  // --- Chart data ---------------------------------------------------
  // x axis = minutes-of-day (CST clock value stored in UTC field), kept to
  // sub-minute (seconds) precision so brief truck arrivals/departures render as
  // thin spikes exactly like the live Highcharts chart (whole-minute rounding
  // would merge or widen them into blocks).
  const tsMin = (ts: string | null): number | null => {
    if (!ts) return null;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return null;
    return d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  // Pour-out = end_unload / wash if present, else fall back to the drive-back stamps
  // so a truck still eventually leaves the "pouring" count (many tickets have no
  // end_unload recorded; dropping the fallback left them counted forever).
  const pourOutTime = (t: TicketRow): string | null =>
    t.end_unload || t.wash_time || t.at_plant_time || t.to_plant_time;

  // Pour Speed chart shows CY/HR rate, not cumulative CY
  // Delivered rate: cumulative_qty / elapsed_hours (from first delivery)
  const deliveredTickets = tickets
    .filter((t) => tsMin(t.on_job_time) != null)
    .sort((a, b) => (a.on_job_time || "").localeCompare(b.on_job_time || ""));

  // Scheduled delivery rate — drives the "Ordered" reference line. Use the ACTUAL rate,
  // INCLUDING 0: a scheduled/closed order with delivery_rate_per_hour = 0 shows an Ordered
  // line of 0, matching D3 (we were wrongly defaulting a 0 rate to 30). Only fall back to
  // 30 when the rate is genuinely absent (null/undefined).
  const scheduleRate = deliveryRatePerHour != null ? deliveryRatePerHour : 30;
  // Rolling rate reference = the SCHEDULED START (order_product_schedules.start_time),
  // matching D3. D3's Delivered/Poured line at each point is the cumulative CY delivered/
  // poured DIVIDED BY the hours elapsed since the scheduled pour start — NOT since the first
  // truck arrived. Measuring from the first arrival made the opening interval tiny (loads
  // bunch at the start), so cumCY ÷ that window exploded (23705: 21 CY ÷ 5.5 min = 227 CY/HR),
  // which the old code then clamped to the ordered rate — flattening the real curve to 42.
  // Anchoring to the scheduled start reproduces D3 across the whole curve with no cap
  // (23705 point 2: 21 CY ÷ (04:19:29 − 04:00) = 64.7 vs D3's 63; later points 15/19/11 match).
  const firstDeliveryTime = deliveredTickets.length > 0 && deliveredTickets[0].on_job_time
    ? new Date(deliveredTickets[0].on_job_time).getTime()
    : null;
  const scheduleStartMs = scheduledTime ? new Date(scheduledTime).getTime() : null;
  // Use the scheduled start when present and it precedes the first delivery (the normal case).
  // Otherwise (no schedule, or a truck that arrived BEFORE the scheduled start) fall back to
  // the first delivery so the elapsed window stays positive.
  const rateStartMs =
    scheduleStartMs != null && (firstDeliveryTime == null || scheduleStartMs <= firstDeliveryTime)
      ? scheduleStartMs
      : firstDeliveryTime;
  // cumulative CY ÷ hours since rateStartMs. A non-positive window (only the very first point,
  // if it coincides with the reference) seeds at the ordered rate, like D3.
  const rollingRate = (cum: number, atMs: number): number => {
    if (rateStartMs == null) return chartOrderedRate;
    const elapsedHours = (atMs - rateStartMs) / 3_600_000;
    return elapsedHours > 0 ? cum / elapsedHours : chartOrderedRate;
  };

  let cumD = 0;
  const delivered = deliveredTickets.map((t) => {
    cumD += cyByTicket.get(t.ticket_id) || 0;
    return { t: tsMin(t.on_job_time)!, v: r2(rollingRate(cumD, new Date(t.on_job_time!).getTime())), ts: t.on_job_time || undefined };
  });

  // Poured rate: cumulative poured-out CY ÷ hours since the scheduled start (same basis).
  const pouredTickets = tickets
    .filter((t) => tsMin(pourOutTime(t)) != null)
    .sort((a, b) => (pourOutTime(a) || "").localeCompare(pourOutTime(b) || ""));

  let cumP = 0;
  const poured = pouredTickets.map((t) => {
    cumP += cyByTicket.get(t.ticket_id) || 0;
    return { t: tsMin(pourOutTime(t))!, v: r2(rollingRate(cumP, new Date(pourOutTime(t)!).getTime())), ts: pourOutTime(t) || undefined };
  });

  // Trucks on the job: waiting (arrived, not pouring) vs pouring, over time.
  // Remember a raw timestamp for each event's x so the tooltip can show H:MM:SS.
  const tsByT = new Map<number, string>();
  const spans = tickets
    .map((t) => {
      const arrive = tsMin(t.on_job_time);
      if (arrive == null) return null;
      const pourStartTs = t.unload_time;
      const pourEndTs = pourOutTime(t);
      const pourStart = tsMin(pourStartTs);
      let pourEnd = tsMin(pourEndTs);
      // Safeguard: if a truck has no pour-out timestamp yet but is clearly done (its last
      // activity is over 3h old — isTicketCompleted), retire it at its latest timestamp so
      // it leaves the count. Without this, trucks whose pour-out data lags never depart and
      // the Waiting/Pouring areas accumulate instead of oscillating like D3.
      if (pourEnd == null && isTicketCompleted(t)) {
        const le = latestTicketEpoch(t);
        if (le != null) {
          const d = new Date(le);
          pourEnd = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
        }
      }
      if (t.on_job_time) tsByT.set(arrive, t.on_job_time);
      if (pourStart != null && pourStartTs) tsByT.set(pourStart, pourStartTs);
      if (pourEnd != null && pourEndTs) tsByT.set(pourEnd, pourEndTs);
      return { arrive, pourStart, pourEnd };
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
    return { t, waiting, pouring, ts: tsByT.get(t) };
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

  // Generate scheduled order points for the "Ordered" reference line. Each point is
  // spaced by truck_space minutes at delivery_rate_per_hour. Cap it to the actual
  // pour-data window (tMax) instead of projecting the entire future schedule —
  // otherwise the x-axis stretches hours past the real data. Matches D3, which
  // draws "Ordered" only across the current pour window.
  const scheduledOrderPoints: { t: number; v: number; ts?: string }[] = [];
  if (scheduledTime && spacingMinutes && spacingMinutes > 0 && totalScheduledLoads && totalScheduledLoads > 0) {
    const startMin = tsMin(scheduledTime);
    const startMs = new Date(scheduledTime).getTime();
    // D3 spaces the "Ordered" points by the EXACT per-load interval — loadCY ÷
    // delivery_rate_per_hour × 60 minutes (e.g. 10.5 ÷ 79 × 60 = 7.9746 min) — NOT the
    // rounded whole-minute truck_space. The fractional interval keeps the point times
    // aligned with D3 to the second (the 9th point lands at 02:03:47, not 02:04:00).
    // Per-load CY = the actual truck load (median ticket CY = 10.5), which is what D3
    // uses; order_qty ÷ number_of_loads (304.51 ÷ 30 = 10.15) is a scheduling estimate
    // that drifts because number_of_loads over-counts the real trips.
    const ticketLoads = [...cyByTicket.values()].filter((x) => x > 0).sort((a, b) => a - b);
    const perLoadCY = ticketLoads.length
      ? ticketLoads[Math.floor(ticketLoads.length / 2)]
      : totalScheduledLoads > 0
        ? ordered / totalScheduledLoads
        : 0;
    const stepMin =
      deliveryRatePerHour && deliveryRatePerHour > 0 && perLoadCY > 0
        ? (perLoadCY / deliveryRatePerHour) * 60
        : spacingMinutes;
    // D3 draws one "Ordered" reference point per TICKETED load (every printed ticket),
    // NOT per delivered/arrived load, and NOT the full remaining schedule. numberOfLoads
    // counts the whole order (e.g. 29), so projecting all of them and capping at tMax
    // leaves trailing points past the tickets that actually exist. Using the printed-
    // ticket count tracks D3: as each new ticket prints, one more Ordered node appears.
    const orderedCount = tickets.length > 0 ? Math.min(totalScheduledLoads, tickets.length) : totalScheduledLoads;
    if (startMin != null && !Number.isNaN(startMs)) {
      for (let i = 0; i < orderedCount; i++) {
        const t = startMin + i * stepMin;
        if (tMax > 0 && t > tMax && scheduledOrderPoints.length > 0) break;
        scheduledOrderPoints.push({
          t,
          v: r2(chartOrderedRate),
          ts: new Date(startMs + i * stepMin * 60000).toISOString(),
        });
      }
    }
  }

  const charts = {
    tMin,
    tMax,
    ordered: r2(chartOrderedRate), // Combined scheduled delivery rate across all waves (CY/HR)
    orderedPoints: scheduledOrderPoints, // Points at each scheduled truck arrival
    delivered,
    poured,
    trucks: trucks_series,
  };

  // --- Production stat tiles (D3 COMPLETE spec) --------------------
  // Volume poured (D3 "POURED") = cumulative CY that has finished unloading. cumP is
  // the real poured-out VOLUME accumulated in the poured-chart loop above (the old
  // code used poured[last].v, which is a RATE, not a volume — that's why POURED read
  // ~40 instead of the full 84 on completed orders).
  const pouredCY = poured.length ? r2(cumP) : r2(ticketed);

  // Pour-window rate (kept for reference).
  const pourStarts = tickets.map((t) => tsMin(t.unload_time)).filter((x): x is number => x != null);
  const pourEnds = tickets.map((t) => tsMin(pourOutTime(t))).filter((x): x is number => x != null);
  let pourRate = 0;
  if (pourStarts.length && pourEnds.length) {
    const durMin = Math.max(...pourEnds) - Math.min(...pourStarts);
    if (durMin > 0) pourRate = pouredCY / (durMin / 60);
  }

  // Arrivals (sorted) drive On-Time % and Producer (Dolese) delay.
  const arrivals = deliveredTickets
    .map((t) => tsMin(t.on_job_time))
    .filter((x): x is number => x != null)
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < arrivals.length; i++) gaps.push(arrivals[i] - arrivals[i - 1]);
  const gapFallback = median(gaps);

  // Planned arrival for the i-th load = scheduled start + i × cadence, where the cadence
  // is D3's pour window: (load CY ÷ delivery rate) × 60, NOT the raw truck_space. This
  // order = 60 × 10.5 CY ÷ 32 CY/hr = 19.69 min, which reproduces D3's Planned On Job
  // column exactly (03:00:00, 03:19:41, 03:39:22 …). Falls back to truck_space, then the
  // observed arrival gap, when the rate/loads aren't known.
  // Producer "DUE" reference: D3 measures producer (Dolese) lateness from the ORDER's requested
  // on-job time — the time-of-day carried on order_date — NOT the plant's per-load scheduled
  // slot. They coincide for most orders (48506: order 15:30 = scheduled 15:30, delay 0), but
  // when the plant reschedules a load LATER than the customer asked, D3 still measures from the
  // request: 26202 was ordered for 14:00 yet scheduled 15:00, and D3's DUE is 14:00 (truck
  // arrived 15:08 → 69 MIN, not 9). Fall back to the schedule start only when order_date carries
  // no time (midnight / date-only).
  const orderDateMin = order.order_date ? tsMin(order.order_date as string) : null;
  const schedStartMin = orderDateMin != null && orderDateMin > 0
    ? orderDateMin
    : (scheduledTime ? tsMin(scheduledTime) : null);
  const loadCY = numberOfLoads && numberOfLoads > 0 ? ordered / numberOfLoads : 0;
  const cadence =
    deliveryRatePerHour && deliveryRatePerHour > 0 && loadCY > 0
      ? (loadCY / deliveryRatePerHour) * 60
      : spacingMinutes && spacingMinutes > 0
        ? spacingMinutes
        : null;
  const plannedArrival = (i: number): number | null => {
    if (schedStartMin != null && cadence != null) return schedStartMin + i * cadence;
    if (arrivals.length) return arrivals[0] + i * gapFallback;
    return null;
  };

  // Producer (Dolese) delay and On-Time % are both DERIVED from the per-load Prod Delay
  // computed in loadDelays below (a load whose Prod Delay is 0 was there on time from the
  // plant's side), so the tiles always agree with the Delay Overview table. Both are
  // filled in after loadDelays is built; onTimePct defaults to 100 (green) when there are
  // no delivered loads — matching D3, never 0% (red).
  let doleseDelay = 0;
  let onTimePct = 100;

  // Per-load Delay Overview (D3's "Delay Overview" table), in arrival order. Columns
  // per the D3 spec:
  //   Prod Delay       = max(0, At Job − planned At Job)             (producer; plus load = 0)
  //   Wait To Pour     = max(0, Begin Pour − At Job)                 (on-site wait to pour)
  //   Contractor Delay = (End Pour − Begin Pour) − planned pour min  (SIGNED; the spec's
  //                      calculation line — measured from BEGIN POUR, not At Job)
  // End Pour uses end_unload → wash_time → to_plant_time; planned pour = truck_space.
  // (Validated against D3's own completed export: this reproduces 6/8 loads exactly and
  // the net tile; the 2 misses are loads that waited — D3 folds the wait in there, but
  // our on_job stamps run early, so we follow the spec's Begin-Pour calculation line.)
  // Pour allotment = whole-minute part of the cadence (D3's "Spacing" column). This
  // order: floor(19.69) = 19. A pour only counts as "over" past this window.
  const allotment = cadence != null ? Math.floor(cadence) : 0;
  // Format a minute-of-day value (fractional, seconds precision) as D3's "HH:MM:SS".
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const minToClock = (m: number | null): string => {
    if (m == null || !Number.isFinite(m)) return "";
    let total = Math.round(m * 60); // → seconds
    total = ((total % 86400) + 86400) % 86400;
    return `${pad2(Math.floor(total / 3600))}:${pad2(Math.floor((total % 3600) / 60))}:${pad2(total % 60)}`;
  };
  const loadDelays = deliveredTickets.map((t, i) => {
    const onJob = tsMin(t.on_job_time);
    const begin = tsMin(t.unload_time);
    const endPour = tsMin(t.end_unload || t.wash_time || t.to_plant_time);
    const planned = plannedArrival(i);
    // D3 "Prod Delay" (producer): the truck is only late from the PLANT's side if it
    // arrived after it was actually needed — after BOTH its scheduled slot AND the moment
    // the site freed up (the previous truck finished pouring). A truck that shows up while
    // the site is still backed up is not a production delay; that lateness is the on-site
    // wait (contractor). So the reference is max(planned, previous load's End Pour).
    const prevEnd = i > 0
      ? tsMin(deliveredTickets[i - 1].end_unload || deliveredTickets[i - 1].wash_time || deliveredTickets[i - 1].to_plant_time)
      : null;
    const prodRef = prevEnd != null && planned != null ? Math.max(planned, prevEnd) : planned;
    // Every delivered load's producer delay is tracked (no plus-load index cut-off): D3
    // counts them all — e.g. order 24304 has 12 delivered loads while only 11 were
    // scheduled, yet D3's DOLESE total includes the 12th load's delay. We have no reliable
    // flag for true add-on/plus loads in the synced data, so tracking every delivered load
    // matches D3 here (the scheduled count is only an estimate and under-counted).
    const prod = prodRef != null && onJob != null
      ? Math.max(0, Math.round(onJob - prodRef)) : 0;
    // D3 "Waiting To Pour" = max(0, Begin Pour − max(At Job, Scheduled slot)): the on-site wait
    // the CONTRACTOR is responsible for. It's measured from actual arrival for an on-time/late
    // truck, but from the SCHEDULED slot when the truck arrived EARLY — the minutes it idled
    // before it was even due aren't a contractor delay (48506: At Job 15:08, scheduled 15:30,
    // Begin Pour 16:26 → wait 56 from the slot, not 78 from arrival → contractor 2, matching D3).
    const sched = tsMin(t.scheduled_on_job_time);
    const readyRef = onJob != null && sched != null ? Math.max(onJob, sched) : onJob;
    const wait = begin != null && readyRef != null ? Math.max(0, Math.round(begin - readyRef)) : 0;
    // D3 "Pour Min Over" = (End Pour − Begin Pour) − allotment, SIGNED — negative when the
    // pour finished inside the allotted window. End Pour = end_unload → wash_time → to_plant.
    const over = endPour != null && begin != null && allotment > 0
      ? Math.round(endPour - begin - allotment) : 0;
    // D3 "Contractor Delay" per load = Waiting To Pour + Pour Min Over (signed).
    return {
      order: i + 1,
      ticket: t.ticket_code || "",
      ticket_id: String(t.ticket_id ?? ""),
      truck: t.truck_code || "",
      planned_on_job: minToClock(planned),
      actual_on_job: minToClock(onJob),
      prod_delay: prod,
      begin_pour: minToClock(begin),
      end_pour: minToClock(endPour),
      scheduled_end_pour: planned != null ? minToClock(planned + allotment) : "",
      spacing: allotment,
      wait_to_pour: wait,
      pour_min_over: over,
      contractor_delay: wait + over,
      // Plus Load = a load beyond the base ordered quantity (call-back/add-on). We can't
      // reliably tell the base-vs-plus split from our synced data, so it's left blank.
      plus_load: "",
    };
  });
  // Tile totals (match D3's completed tiles). Producer (Dolese) = Σ per-load Prod Delay
  // (each already floored at 0). Customer (ROSE) = max(0, Σ Contractor Delay) — the NET
  // over/under the allotment across all loads, floored at 0: loads that ran long are
  // offset by loads that poured fast, so 23302 nets −45 → tile shows 0, exactly like D3.
  doleseDelay = loadDelays.reduce((s, l) => s + Math.max(0, l.prod_delay), 0);
  const customerDelay = Math.max(0, loadDelays.reduce((s, l) => s + l.contractor_delay, 0));
  const jobDelay = customerDelay; // back-compat alias for the existing field

  // On-Time % = share of ALL delivered loads whose Prod Delay is 0 — i.e. the plant had
  // the truck on site before the crew ran out of concrete (no producer idle). Consistent
  // with the DOLESE tile and the Delay Overview. D3 truncates the ratio: 24304 = 3 of 12
  // loads with zero Prod Delay → 25%; 48508 = 2 of 3 → 66%.
  const onTimeDen = loadDelays.length;
  const onTimeNum = loadDelays.filter((l) => l.prod_delay === 0).length;
  onTimePct = onTimeDen ? Math.floor((100 * onTimeNum) / onTimeDen) : 100;

  // Activity feed = D3's Social Stream. Three sources, merged newest→oldest:
  //   1. truck-movement messages, reconstructed from ticket timestamps (D3 live-recomputes
  //      these "expected to arrive" ETAs, so we compute them too rather than replay the log);
  //   2. user-entered notes (order_notes);
  //   3. dispatch change events (order_change_logs) — status & volume changes like
  //      "Status changed from Firm to Hold" / "Volume changed from 52.50 to 63.00".
  // Every item carries a CST-wall-clock sort key so the three streams interleave in one true
  // chronological order (ticket times are CST-clock-in-UTC; note/change times are real
  // instants normalised via realInstantToCstClockMs).
  type FeedItem = { text: string; time: string; ms: number; ord: number };
  const addrLabel = order.delivery_addr1 || order.project_name || "the job";
  const moved = tickets
    .filter((t) => has(t.to_job_time) || has(t.on_job_time))
    .sort((a, b) =>
      (b.to_job_time || b.on_job_time || "").localeCompare(a.to_job_time || a.on_job_time || ""),
    );
  const truckActivity = moved
    .map((t, idx): FeedItem | null => {
      const raw = t.to_job_time || t.on_job_time;
      const stamp = fmtStamp(raw);
      if (!stamp || !t.truck_code) return null;
      const arrive = fmtTime(t.on_job_time || t.to_job_time, false) || "";
      const text =
        idx === 0
          ? `Truck ${t.truck_code} is your last load for ${addrLabel}. If you need more concrete, please call Dispatch.`
          : `Truck ${t.truck_code} heading to ${addrLabel} and is expected to arrive at ${arrive}`;
      return { text, time: stamp, ms: new Date(raw!).getTime(), ord: 0 };
    })
    .filter((m): m is FeedItem => m != null);

  // User-entered notes from order_notes = D3's "user generated posts". note_date is a real
  // tz-aware instant → format/sort in CST.
  const { data: noteRows } = await supabase
    .from("order_notes")
    .select("note_description, note_date")
    .eq("order_id", orderId)
    .order("note_date", { ascending: false })
    .limit(200);
  const noteActivity: FeedItem[] = (noteRows || [])
    .filter((n) => (n.note_description || "").toString().trim() !== "")
    .map((n) => ({
      text: String(n.note_description).trim(),
      time: fmtNoteStamp(n.note_date) || "",
      ms: realInstantToCstClockMs(n.note_date) ?? 0,
      ord: 0,
    }));

  // Dispatch change events from order_change_logs — D3's audit entries. These ARE now in the
  // DB (the full production cluster carries order_change_logs; the old thin mirror did not, so
  // this feed used to omit them). We render the two the D3 stream shows as their own bubbles —
  // current_status and order volume — matching D3's wording: short status names (0 = "Firm",
  // 4 = "Comp") and half-yard volumes, and we DROP no-op changes (a 52.51→52.50 volume edit
  // that rounds to the same figure, or a status that maps to the same label), exactly as D3 does.
  const { data: changeRows } = await supabase
    .from("order_change_logs")
    .select("changed_at, display_order, field_name, old_value, new_value")
    .eq("order_id", orderId)
    .in("field_name", ["current_status", "volume"])
    .order("changed_at", { ascending: false })
    .limit(300);
  const changeActivity = (changeRows || [])
    .map((r): FeedItem | null => {
      let text = "";
      if (r.field_name === "current_status") {
        const from = D3_FEED_STATUS[String(r.old_value)] ?? String(r.old_value ?? "");
        const to = D3_FEED_STATUS[String(r.new_value)] ?? String(r.new_value ?? "");
        if (!to || from === to) return null;
        text = `Status changed from ${from} to ${to}`;
      } else {
        const o = halfYardLabel(Number(r.old_value));
        const n = halfYardLabel(Number(r.new_value));
        if (!Number.isFinite(Number(r.new_value)) || o === n) return null;
        text = `Volume changed from ${o} to ${n}`;
      }
      // order_change_logs.changed_at is a CST clock value in a UTC field (like ticket times,
      // and UNLIKE order_notes.note_date which is a real instant) — D3 reads its UTC parts
      // directly as the CST clock (09:13Z → "9:13AM CST"). So format/sort with fmtStamp +
      // getTime, matching D3 (converting it via fmtNoteStamp shifted every event 5h early).
      return { text, time: fmtStamp(r.changed_at) || "", ms: new Date(r.changed_at!).getTime(), ord: Number(r.display_order) || 0 };
    })
    .filter((m): m is FeedItem => m != null);

  // Merge all three streams newest→oldest (ties broken by display_order so a status + volume
  // change at the same instant read in D3's order). The order-summary card is appended last by
  // the client. Strip the sort keys before returning.
  const activityFeed = [...truckActivity, ...noteActivity, ...changeActivity]
    .sort((a, b) => b.ms - a.ms || a.ord - b.ord)
    .map(({ text, time }) => ({ text, time }));

  // Measured concrete temperature for the evaporation estimate — D3 uses the CURRENT
  // load's Verifi reading (temp at discharge/pour), not a fixed value, so the tile and
  // the Evaporation Details page vary (75F, 92F…). "Current" = the most recent load that
  // has actually POURED OUT: a truck still en route can carry a stale pre-discharge temp
  // (e.g. a leave-plant value) and a poured load may have no Verifi reading at all, so we
  // walk newest→oldest through the poured-out loads and take the first with a real temp.
  // Keying on the single highest ticket number instead (its verifi_json is often null) is
  // why the tile silently vanished on some in-process orders.
  const evapCandidates = tickets
    .filter(isPouredOut)
    .sort((a, b) => (b.ticket_code || "").localeCompare(a.ticket_code || ""));
  let measuredConcreteF: number | null = null;
  let evapTicket: TicketRow | null = null;
  if (evapCandidates.length) {
    const { data: vrows } = await supabase
      .from("tickets").select("ticket_id, verifi_json")
      .in("ticket_id", evapCandidates.map((t) => t.ticket_id));
    const vById = new Map(
      (vrows || []).map((r) => [r.ticket_id, (r.verifi_json as Record<string, unknown>) || null]),
    );
    for (const t of evapCandidates) { // newest → oldest
      const vj = vById.get(t.ticket_id);
      if (!vj) continue;
      const tv = (k: string) => {
        const s = vVal(vj[k], "temperatureUnitsValue");
        return s != null && s !== "" ? Number(s) : null;
      };
      const temp = tv("temperatureAtDischarge") ?? tv("temperatureAtArrival") ?? tv("temperatureAtLeavePlant");
      if (temp != null) { measuredConcreteF = temp; evapTicket = t; break; }
    }
  }
  // Completion follows the D3 spec: Complete once the POURED-OUT volume reaches the
  // ordered amount (not the dispatch flag, not merely "all loads ticketed"). Keeps the
  // detail page in step with the tile list and with D3.
  const pouredOutCY = tickets.reduce(
    (s, t) => s + (isPouredOut(t) ? cyByTicket.get(t.ticket_id) || 0 : 0),
    0,
  );
  const status = deriveStatus(order, ordered, pouredOutCY, tickets.length > 0);

  // Pour Finish (D3 ORDER HELP): "Estimated time the last truck will finish
  // pouring based on CURRENT PROGRESS." We compute two candidates and take the
  // LATER of them:
  //   (1) schedule projection  = start + number_of_loads × truck_space (the plan)
  //   (2) progress projection  = pour-start + ordered ÷ current pour throughput
  // Taking the later means a job running BEHIND slips its finish out (the spec's
  // intent), while noisy early data — the first few trucks always arrive fast, which
  // would otherwise project an unrealistically EARLY finish — can't pull it in ahead
  // of the plan. NOTE: an exact match to D3 also needs each load's pour-finish stamp
  // (end_unload); those are absent from our mirror, so the progress rate is derived
  // from the pour-out fallback (wash/plant) and is an approximation.
  const allScheduleTimes = rawProducts
    .flatMap((p) => (p.order_product_schedules || []) as { start_time: string | null; number_of_loads?: number | null; truck_space?: number | null }[])
    .filter((s) => s.start_time);

  // Candidate 1: scheduled finish (ms in the CST-as-UTC frame).
  let scheduleFinishMs: number | null = null;
  if (allScheduleTimes.length > 0 && allScheduleTimes[0].number_of_loads && allScheduleTimes[0].truck_space) {
    const schedule = allScheduleTimes[0];
    const startTime = new Date(schedule.start_time!);
    const totalMinutes = (schedule.number_of_loads || 0) * (schedule.truck_space || 0);
    scheduleFinishMs = startTime.getTime() + totalMinutes * 60 * 1000;
  }

  // Candidate 2: progress projection from the site's DEMONSTRATED pour throughput.
  // We don't have per-load pour-finish stamps (end_unload), so — using the columns
  // we DO have — a load counts as "poured out" via its wash/plant stamps (see
  // isPouredOut → pouredOutCY), and we measure throughput as poured-out VOLUME ÷
  // ELAPSED time since pouring began. Using elapsed wall-time (not just the span
  // between pour events) captures the real on-site pace INCLUDING trucks waiting to
  // pour — which is exactly why D3's estimate runs hours past the ideal schedule.
  // Pour Finish = pour-start + ordered ÷ that throughput.
  // Effective pour rate per D3's Pour Speed definition: total poured-out VOLUME ÷
  // the TOTAL time trucks spent on the job — each poured-out load's on_job →
  // pour-finish (using wash/plant as the pour-finish proxy, since end_unload is
  // absent from our data). That job-time INCLUDES the on-site waiting before each
  // truck pours, which is exactly why the real pace — and the finish — trail the
  // ideal schedule, the way D3's estimate does.
  // D3 "Pour Rate" tile = MEAN of per-load delivery rates, each = load CY ÷ the truck's
  // ON-SITE CYCLE in hours: At Job → To Plant (arrival until it leaves for the plant). We
  // use this arrival→leave window rather than the raw Begin→End pour because our sync has
  // no reliable pour-finish — end_unload is always null and wash_time is sometimes logged
  // seconds after Begin Pour. The on-site cycle IS carried (To Plant is a dependable end
  // marker) and empirically reproduces D3: order 24304 = 27. For a load that has finished
  // pouring but has no To Plant stamp yet, fall back to wash_time → end_unload. Outlier
  // loads are dropped before the mean (a plus/add-on load or a stamp glitch yields a wild
  // rate): any per-load rate above 2× the median is excluded.
  //
  // Caveat: an order whose trucks sat with long on-site WAITS before pouring reads low
  // here — the wait is inside At Job→To Plant, and we lack the true Begin→End pour D3 uses.
  // e.g. 48508 reads ~12 vs D3's 16. That's a data-sync gap, not a formula bug.
  const loadRates: number[] = [];
  for (const t of tickets) {
    const arrRaw = tsMin(t.on_job_time);
    const sched = tsMin(t.scheduled_on_job_time);
    // On-site cycle starts at the LATER of actual arrival and the scheduled slot: a truck that
    // shows up EARLY and sits until its slot shouldn't have that idle time dragging its rate
    // down. D3 measures from the slot in that case (48506: At Job 15:08 but scheduled 15:30 —
    // cycle 15:30→to-plant, rate 5, not 15:08→to-plant, rate 3). A late truck (arrival ≥ slot)
    // is unchanged since max(arrival, slot) = arrival.
    const arr = arrRaw != null && sched != null ? Math.max(arrRaw, sched) : arrRaw;
    const fin = tsMin(t.to_plant_time || t.wash_time || t.end_unload);
    const cyv = cyByTicket.get(t.ticket_id) || 0;
    if (arr == null || fin == null || fin <= arr || cyv <= 0) continue;
    loadRates.push(cyv / ((fin - arr) / 60));
  }
  const medRate = median(loadRates);
  const keptRates = medRate > 0 ? loadRates.filter((r) => r <= 2 * medRate) : loadRates;
  const pourRateTile = keptRates.length
    ? keptRates.reduce((a, b) => a + b, 0) / keptRates.length
    : 0;
  // "Now" reference (D3 anchors NEXT TRUCK and POUR FINISH at the live clock). Our
  // mirror lags, so we approximate "now" with the most recent real activity timestamp
  // on any ticket — the latest stage stamp across the order.
  const nowMin = (() => {
    let mx: number | null = null;
    for (const t of tickets) {
      for (const ts of [
        t.printed_time, t.load_time, t.loaded_time, t.to_job_time, t.on_job_time,
        t.unload_time, t.end_unload, t.wash_time, t.to_plant_time, t.at_plant_time,
      ]) {
        const m = tsMin(ts);
        if (m != null && (mx == null || m > mx)) mx = m;
      }
    }
    return mx;
  })();

  // Pour-Finish projection (D3): the remaining volume is delivered at the SCHEDULED
  // delivery rate (the sustained throughput of the operation — with several trucks
  // pouring in parallel the bottleneck is the delivery cadence, not one truck's pour
  // speed), projected forward from "now". e.g. 40904: 04:55 + 157.51 CY ÷ 79 CY/HR =
  // 06:55, matching D3 exactly.
  let progressFinishMs: number | null = null;
  if (ordered > 0 && scheduleRate > 0 && nowMin != null) {
    // Pour-out stamps lag in our mirror: a load that went on the job long ago can still be
    // missing its wash/pour-out stamp even though it must have finished pouring (e.g. 40502
    // load 40563358 — on-job 03:55, no stamp at ~06:00). Counting only stamped loads
    // understates poured volume, inflates "remaining", and reads the ETA late (6:53 vs D3
    // 6:45). So treat a delivered load as poured once it has been on the job longer than a
    // typical discharge window (arrive→pour-out ≈ 6–13 min in the data; 20 gives margin) —
    // it physically cannot still be pouring. Recently-arrived loads still count as pending.
    const DISCHARGE_MIN = 20;
    let effectivePoured = pouredCY;
    for (const t of tickets) {
      if (isPouredOut(t)) continue; // already in pouredCY
      const oj = tsMin(t.on_job_time);
      if (oj != null && oj < nowMin - DISCHARGE_MIN) effectivePoured += cyByTicket.get(t.ticket_id) || 0;
    }
    const remainingCY = Math.max(0, ordered - effectivePoured);
    const od = new Date(order.order_date as string);
    const base = Date.UTC(od.getUTCFullYear(), od.getUTCMonth(), od.getUTCDate());
    progressFinishMs = base + nowMin * 60000 + (remainingCY / scheduleRate) * 3600000;
  }

  let pourFinish: string | null = null;
  let finishMs =
    scheduleFinishMs != null && progressFinishMs != null
      ? Math.max(scheduleFinishMs, progressFinishMs) // running behind → push later
      : (progressFinishMs ?? scheduleFinishMs);
  // An in-process order's pour cannot finish in the PAST. Our "now" proxy (nowMin) is the
  // latest ticket stamp, which freezes when stamps stop arriving at the tail of a pour — so
  // a projection anchored to it can fall behind the real clock (48107: last stamp 08:53 while
  // the real clock was 09:11, so the tile showed a 08:53 finish 18 min in the past). Floor
  // the finish at the live Central clock so it never reads a past time. NOTE: this stops the
  // under-report but won't reach D3's later value — D3 knows the last truck is still pouring
  // (it projects that discharge forward); our mirror lacks that load's pour-out stamp, so our
  // "poured after 20 min on job" heuristic treats it as already done (remaining ≈ 0).
  if (finishMs != null && status !== "COMPLETED") {
    finishMs = Math.max(finishMs, nowInCstClockMs());
  }
  if (finishMs != null) {
    pourFinish = fmtTime(new Date(finishMs).toISOString(), true);
  } else {
    // Last resort: the latest recorded pour-end time.
    const pourFinishRaw = tickets
      .map((t) => t.end_unload || t.wash_time)
      .filter((x): x is string => !!x)
      .sort();
    pourFinish = pourFinishRaw.length ? fmtTime(pourFinishRaw[pourFinishRaw.length - 1], true) : null;
  }

  // Next Truck (D3): minutes until the next truck arrives = the earliest not-yet-arrived
  // truck's SCHEDULED on-job time minus "now". e.g. 40904: next scheduled arrival 05:02
  // − now 04:55 = 6 MIN. When that truck is already due or overdue (scheduled ≤ now but
  // not yet on the job), D3 shows "Now" — so we take the earliest pending arrival and
  // don't filter out overdue ones. (D3's ETAs come from live GPS, absent in our mirror —
  // scheduled_on_job_time is the closest proxy.)
  let nextTruck: string | null = null;
  if (status !== "COMPLETED") {
    const pendingArrivals = tickets
      .filter((t) => !has(t.on_job_time))
      .map((t) => tsMin(t.scheduled_on_job_time))
      .filter((m): m is number => m != null)
      .sort((a, b) => a - b);

    if (pendingArrivals.length > 0 && nowMin != null) {
      const mins = Math.round(pendingArrivals[0] - nowMin);
      nextTruck = mins <= 0 ? "Now" : `${mins} MIN`;
    } else if (actualTicketedCY >= ordered - 0.02) {
      // Every ordered load has been dispatched and none is en route → there is no next
      // truck at all. D3 shows "None" (not "Waiting", which is only for the gap between
      // deliveries while more loads are still to come).
      nextTruck = "None";
    } else {
      // No trucks en route but more loads are still to come. If loads are currently at
      // the jobsite the next-truck state is "Waiting" (D3 ORDER HELP); otherwise fall
      // back to the scheduled first-load time.
      const onJobNow = tickets.some((t) => has(t.on_job_time) && !hasLeftJob(t));
      nextTruck = onJobNow ? "Waiting" : fmtTime(earliestStart(rawProducts), true);
    }
  }

  // Weather (JSONB): our DB stores a "weatherapi" shape (temperature_fahrenheit,
  // weather_description, pressure_hpa, wind_speed_mph, wind_direction, fetched_at);
  // older rows use the OpenWeatherMap shape. Handle both.
  let weather: DoleseOrderDetail["weather"] = null;
  let evaporation: DoleseOrderDetail["evaporation"] = null;
  // Dynamic: fetch live current weather from OpenWeatherMap at the PLANT location (the
  // ORDER HELP shows plant-local weather). Falls back to the stored weather_data JSONB
  // when the key/coords are missing or the API call fails.
  const owmKey = process.env.OPENWEATHERMAP_API_KEY;
  let w = order.weather_data as Record<string, unknown> | null;
  // Prefer LIVE OpenWeatherMap at the plant — that's exactly what the D3 ORDER HELP tile
  // shows (e.g. "82.96F Clear Sky", H 71% P 1016 W 3 S), not the stored WeatherAPI sync
  // ("Sunny", 67%, 10.3 SSW). Fall back to the stored weather_data only if the live call
  // fails or the key/coords are missing.
  if (owmKey && plantLat != null && plantLng != null) {
    const live = await fetchOWMWeather(plantLat, plantLng, owmKey);
    if (live) w = live;
  }
  if (w && typeof w === "object") {
    const num = (v: unknown): number | undefined => {
      const n = typeof v === "number" ? v : v != null && v !== "" ? Number(v) : NaN;
      return Number.isFinite(n) ? n : undefined;
    };
    const main = (w.main as Record<string, unknown>) || {};
    const wind = (w.wind as Record<string, unknown>) || {};

    const tempF = num(w.temperature_fahrenheit) ?? num(w.temperature) ?? num(w.temp) ?? num(main.temp);
    const desc =
      (w.weather_description as string | undefined) ??
      (w.weather_condition as string | undefined) ??
      (w.description as string | undefined) ??
      (Array.isArray(w.weather) ? ((w.weather[0] as Record<string, unknown>)?.description as string) : undefined);
    const humidity = num(w.humidity) ?? num(main.humidity);
    const pressure = num(w.pressure_hpa) ?? num(w.pressure) ?? num(main.pressure) ?? num(w.pressure_inhg);
    const windMph = num(w.wind_speed_mph) ?? num(w.wind_speed) ?? num(wind.speed);
    // direction is a compass string (weatherapi) or degrees (OWM)
    const dirStr = typeof w.wind_direction === "string" ? (w.wind_direction as string) : undefined;
    const windDeg = num(w.wind_direction_degrees) ?? num(w.wind_deg) ?? num(wind.deg);
    const direction = dirStr ?? (windDeg != null ? compassDir(windDeg) : undefined);
    const fetchedAt = (w.fetched_at ?? w.dt ?? w.last_update ?? w.updated) as number | string | undefined;

    // Weather "Last Update" — fetched_at is a real UTC timestamp, so convert it to
    // the plant's LOCAL time (US Central), which the ORDER HELP requires ("All times
    // are displayed in local time of plant"). Uses the America/Chicago zone so it's
    // DST-correct (CDT in summer); labelled "CST" to match D3.
    let updatedDate: Date | null = null;
    if (typeof fetchedAt === "number") updatedDate = new Date(fetchedAt * 1000);
    else if (typeof fetchedAt === "string") {
      const d = new Date(fetchedAt);
      if (!Number.isNaN(d.getTime())) updatedDate = d;
    }
    let updated: string | undefined;
    if (updatedDate) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Chicago",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).formatToParts(updatedDate);
      const g = (t: string) => parts.find((p) => p.type === t)?.value || "";
      updated = `${g("hour")}:${g("minute")}${g("dayPeriod").replace(/\s/g, "")} CST`;
    } else if (typeof fetchedAt === "string") {
      updated = fetchedAt;
    }

    if (tempF != null || desc) {
      // Match D3's ORDER HELP formatting: temp to 2 decimals with an "F" suffix (no degree
      // sign), Title-Cased condition ("clear sky" → "Clear Sky"), whole-number wind speed.
      const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
      weather = {
        temp: tempF != null ? `${tempF.toFixed(2)}F` : undefined,
        description: desc ? titleCase(desc) : undefined,
        place: plantName || order.pricing_plant_code || undefined,
        humidity: humidity != null ? `${Math.round(humidity)}%` : undefined,
        pressure: pressure != null ? String(Math.round(pressure)) : undefined,
        wind: windMph != null ? String(Math.round(windMph)) : undefined,
        direction,
        updated,
        // Icon: map the stored WeatherAPI icon (day/night + condition) to D3's own weather
        // glyph vendored in Order_files; else map the OpenWeatherMap code the same way.
        icon:
          (typeof w.weather_icon === "string" && w.weather_icon ? weatherApiGlyph(w.weather_icon as string) : undefined) ??
          owmGlyph(Array.isArray(w.weather) ? ((w.weather[0] as Record<string, unknown>)?.icon as string) : undefined),
      };

      // Surface-evaporation estimate — the "EvaporationRateVerifi" tile. D3 only shows it
      // when the current ticket has a REAL Verifi concrete-temperature reading; with no
      // Verifi temp there's no tile (D3 does not fall back to a default). So gate the whole
      // estimate on measuredConcreteF being present — no reading → no evaporation → no tile.
      if (measuredConcreteF != null && tempF != null && humidity != null && windMph != null) {
        const CONCRETE_F = measuredConcreteF;
        const rate = evaporationRate(tempF, humidity, windMph, CONCRETE_F);
        evaporation = {
          rate,
          concreteTempF: CONCRETE_F,
          risk: crackingRisk(rate),
          ticketNo: evapTicket?.ticket_code ?? null,
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
    scheduled_time_raw: scheduledTime,
    delivery_rate: deliveryRatePerHour,
    // D3's "Spacing" = the rate-derived pour cadence floored to whole minutes
    // (floor(loadCY ÷ delivery_rate × 60)), NOT the raw truck_space. Same value the
    // delay table uses as "Spacing". e.g. 40904: floor(10.5÷79×60)=7 (truck_space is 8);
    // 23302: floor(10.5÷32×60)=19 (truck_space is 20). Falls back to truck_space if no rate.
    spacing_minutes: allotment > 0 ? allotment : spacingMinutes,
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
    pour_rate: Math.round(pourRateTile),
    dolese_delay_min: doleseDelay,
    job_delay_min: jobDelay,
    customer_delay_min: customerDelay,
    delay_loads: loadDelays,
    next_truck: nextTruck,
    pour_finish: pourFinish,
    weather,
    evaporation,
    charts,
    activity: activityFeed,
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
      "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products(order_qty, order_qty_unit, delv_qty, is_mix)",
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

  // Delivery (chronological) order drives the running cumulative CY + load number.
  const chrono = [...tickets].sort((a, b) =>
    (a.printed_time || "").localeCompare(b.printed_time || "") ||
    (a.ticket_code || "").localeCompare(b.ticket_code || ""),
  );
  let cumulative = 0;
  const cumById = new Map<number, number>();
  const noById = new Map<number, number>();
  chrono.forEach((t, i) => {
    cumulative = Math.round((cumulative + (cyByTicket.get(t.ticket_id) || 0)) * 100) / 100;
    cumById.set(t.ticket_id, cumulative);
    noById.set(t.ticket_id, i + 1);
  });

  // Display in load-number order (1, 2, 3 …) — i.e. delivery/chronological order, which is
  // exactly how the load numbers were assigned above.
  const loads: DoleseLoad[] = chrono.map((t) => {
    const cy = Math.round((cyByTicket.get(t.ticket_id) || 0) * 100) / 100;
    const stage = ticketStage(t);
    return {
      ticket_id: t.ticket_id,
      load_no: noById.get(t.ticket_id) || 0,
      ticket_code: t.ticket_code,
      truck_code: t.truck_code,
      plant_name: t.plant_name,
      load_cy: cy,
      cumulative_cy: cumById.get(t.ticket_id) || 0,
      total_cy: totalCY,
      status: stage.label,
      status_time: stage.time ? (fmtTime(stage.time, true) || "").replace(/\s+/g, "") : null,
    };
  });

  // Complete once poured-out volume reaches the ordered amount (D3 spec).
  const pouredOutCY = tickets.reduce(
    (s, t) => s + (isPouredOut(t) ? cyByTicket.get(t.ticket_id) || 0 : 0),
    0,
  );
  const status = deriveStatus(order, ordered, pouredOutCY, tickets.length > 0);

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    order_date: order.order_date,
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
    .select("id, item_id, charge_type, item_code, description, short_description, is_mix, load_qty, delv_qty, order_qty_unit, delv_qty_unit, slump")
    .eq("ticket_id", ticketId)
    .limit(50);

  // Product tile order: extra-charge line(s) first (charge_type ≠ "0", e.g. the fuel
  // surcharge), then the remaining products in natural storage order — so the concrete
  // MIX, stored first, shows FIRST. Verified against ticket 578713 (A405A0 mix, 20001) →
  // D3 renders A405A0 (green mix) first. NOTE: D3's ordering isn't fully consistent — a
  // surcharge-bearing ticket (24269229) renders MSX90660, 20811, A6511, which no single
  // ticket_products column reproduces for BOTH tickets; this rule matches the common
  // "mix first" case and keeps charges pinned on top.
  const isCharge = (p: { charge_type?: string | number | null }) =>
    p.charge_type != null && String(p.charge_type) !== "0" ? 0 : 1;
  const orderedTp = (tp || []).slice().sort(
    (a, b) => isCharge(a) - isCharge(b) || Number(a.id || 0) - Number(b.id || 0),
  );

  // ORDER product cards (mix shown green in the UI). Quantity is the DELIVERED amount
  // (delv_qty), like D3 — for per-yard admixtures that's the total across the load
  // (e.g. 10.50 EA), NOT the 1.00 per-CY dose stored in load_qty. Fall back to load_qty
  // only when nothing has been delivered yet (delv_qty 0/null on an in-progress ticket).
  const products: TicketProductCard[] = orderedTp.map((p) => {
    const unitRaw = (p.order_qty_unit || p.delv_qty_unit || "ea").toLowerCase();
    const delivered = p.delv_qty != null && Number(p.delv_qty) > 0 ? Number(p.delv_qty) : null;
    return {
      item_code: p.item_code || "—",
      description: p.description || p.short_description || "",
      qty: delivered != null ? delivered : Number(p.load_qty ?? p.delv_qty ?? 0),
      unit: unitRaw === "ea" ? "EACH" : (p.order_qty_unit || p.delv_qty_unit || "").toUpperCase(),
      slump: p.slump != null ? Number(p.slump) : null,
      is_mix: p.is_mix === true,
    };
  });

  const v = (t.verifi_json as Record<string, unknown> | null) || null;
  const mix = (v?.mixCodeName as string) || products.find((p) => p.is_mix)?.item_code || "—";
  const truck = t.truck_code || "";
  const events: TicketEventCard[] = [];

  // Verifi field getters — the JSON nests each reading as a small object
  // ({slump:"5.75"}, {temperatureUnitsValue:"94"}, {volumeValue:"1.2"} …).
  const slumpV = (k: string) => vVal(v?.[k], "slump");
  const tempV = (k: string) => vVal(v?.[k], "temperatureUnitsValue");
  const ageV = (k: string) => vVal(v?.[k], "age");
  const volV = (k: string) => vVal(v?.[k], "volumeValue");
  const revsV = (k: string) => {
    const r = v?.[k];
    return r == null || r === "" ? null : String(r);
  };

  // Blue truck-status card. The VERIFI sub-line is shown ONLY when there is an actual
  // sensor reading — D3 omits the line entirely when there's none (it does NOT print
  // "VERIFI: N/A"). So a missing/empty/false verifi value renders no sub-line at all.
  const stage = (icon: string, label: string, ts: string | null, verifi: string | null | false) => {
    if (!has(ts)) return;
    events.push({
      icon,
      title: `TRUCK ${truck} ${label}:`,
      value: (fmtTime(ts, true) || "").replace(/\s+/g, ""),
      sub: verifi ? `VERIFI: ${verifi}` : undefined,
      dark: false,
    });
  };
  // Dark Verifi sensor card: mix name + "LABEL: value" + a stage sub-line.
  const metric = (label: string, value: string | null, unit: string, sub: string) =>
    events.push({ icon: "verifi", title: mix, value: `${label}: ${value != null ? `${value}${unit}` : "NA"}`, sub, dark: true });

  // D3's "VERIFI WATER ADD" tiles show water added DURING that leg — the change in
  // the cumulative Verifi reading since the previous stage, not the raw cumulative.
  // Cumulative here: leavePlant 2.4, arrival 0.0 → AT JOB = arrival − leavePlant =
  // 0.0 − 2.4 = −2.40 GAL/CY (a correction). TO JOB is the first reading (baseline
  // 0) so its delta equals the raw value (2.4).
  const wNum = (k: string) => { const s = volV(k); return s == null ? null : Number(s); };
  const wLeave = wNum("verifiWaterAtLeavePlant");
  const wArr = wNum("verifiWaterAtArrival");
  const legWater = (cur: number | null, prev: number | null) =>
    cur == null && prev == null ? null : ((cur ?? 0) - (prev ?? 0)).toFixed(2);

  // ---- D3's exact 34-card delivery timeline ----------------------
  stage("ticketed", "Ticketed", t.printed_time, false);
  stage("loading", "Loading", t.load_time, fmtClock(v?.loading as string));
  if (v) metric("SLUMP", slumpV("slumpAtInitialSlump"), " IN", "LOADING");
  stage("loaded", "Loaded", t.loaded_time, fmtClock(v?.loaded as string));
  stage("to_job", "To Job", t.to_job_time, fmtClock(v?.leavePlant as string));
  if (v) {
    metric("AGE", ageV("ageAtLeavePlantMinutes"), " min", "TO JOB");
    metric("SLUMP", slumpV("slumpAtLeavePlant"), " IN", "TO JOB");
    metric("TEMP", tempV("temperatureAtLeavePlant"), " F", "TO JOB");
    // D3's "REVS" tile at TO JOB shows the leave-plant SLUMP value (e.g. 3.50 / 4.50 =
    // slumpAtLeavePlant), not the revolution count — verified against production.
    metric("REVS", slumpV("slumpAtLeavePlant"), "", "TO JOB");
    metric("WATER", volV("verifiWaterAtLeavePlant") ?? "0.0", " GAL/CY", "TO JOB - VERIFI WATER ADD");
  }
  stage("at_job", "At Job", t.on_job_time, fmtClock(v?.arriveSite as string));
  if (v) {
    metric("AGE", ageV("ageAtArrivalMinutes"), " min", "AT JOB");
    metric("REVS", revsV("totalRevsAtArrival"), "", "AT JOB");
    metric("ADMIX", volV("admixTotalVolumeAtArrival") ?? "0.0", " OZ/CY", "AT JOB");
    metric("TIME", vVal(v?.timeOnSiteMinutes, "time"), " min", "AT JOB");
    metric("WATER", legWater(wArr, wLeave) ?? "0.0", " GAL/CY", "AT JOB - VERIFI WATER ADD");
    metric("SLUMP", slumpV("slumpAtArrival"), " IN", "AT JOB");
    metric("TEMP", tempV("temperatureAtArrival"), " F", "AT JOB");
  }
  stage("pouring", "Pouring", t.unload_time, fmtClock(v?.beginPour as string));
  if (v) {
    metric("AGE", ageV("ageAtDischargeMinutes"), " min", "POURING");
    metric("REVS", revsV("totalRevsSinceLoadedAtDischarge"), "", "POURING");
    metric("ADD WATER", volV("verifiWaterAtDischarge") ?? "0.0", " GAL/CY", "POURING - MANUAL WATER ADD");
    metric("ADMIX", volV("admixTotalVolumeAtDischarge") ?? "0.0", " OZ/CY", "POURING");
    metric("SLUMP", slumpV("slumpAtDischarge"), " IN", "POURING");
    metric("TEMP", tempV("temperatureAtDischarge"), " F", "POURING");
  }
  // Post-pour summary cards only appear once the truck reaches the matching stage — D3
  // hides them while the load is still pouring. VOLUME POURED shows after the pour ends;
  // MANUAL ADD / TOTAL WATER / ROUND TRIP only after the truck is back at the plant.
  const pourFinished = has(t.end_unload) || has(t.wash_time);
  const backAtPlant = has(t.at_plant_time);
  // End Pour lives in wash_time when end_unload isn't synced (D3 labels it "Finish Pour").
  stage("poured", "Finish Pour", t.end_unload || t.wash_time, fmtClock(v?.endPour as string));
  if (v && pourFinished) {
    const poured = vVal(v.loadSize, "loadSize") || (products.find((p) => p.is_mix)?.qty != null ? String(products.find((p) => p.is_mix)?.qty) : null);
    if (poured != null) events.push({ icon: "verifi", title: mix, value: `${poured} CY`, sub: "VOLUME POURED", dark: true });
  }
  stage("washing", "Washing", t.wash_time, false);
  // D3 uses a distinct END WASH glyph (3 drops) for End Washing, not the WASHING one.
  stage("end_wash", "End Washing", t.to_plant_time, false);
  stage("to_plant", "To Plant", t.to_plant_time, fmtClock(v?.leaveSite as string));
  stage("at_plant", "At Plant", t.at_plant_time, fmtClock(v?.returnPlant as string));
  if (v && backAtPlant) {
    const manual = volV("verifiWaterAtDischarge");
    if (manual != null) events.push({ icon: "verifi", title: mix, value: `MANUAL ADD: ${manual} GAL/CY`, sub: "MANUAL ADDITION OF WATER", dark: true });
    const total = volV("verifiWaterTotal");
    if (total != null) events.push({ icon: "verifi", title: mix, value: `TOTAL WATER: ${total} GAL/CY`, sub: "ADDED TO LOAD", dark: true });
  }
  const roundTrip = typeof v?.startToEndTotalMinutes === "string" ? v.startToEndTotalMinutes : null;
  // D3 renders ROUND TRIP TIME as a Verifi (dark) tile, not a blue truck-status tile.
  if (roundTrip && backAtPlant) events.push({ icon: "verifi", title: `TRUCK ${truck}`, value: roundTrip, sub: "ROUND TRIP TIME", dark: true });

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
/*  5b. Truck Arrival — active trucks heading to / on the job         */
/* ------------------------------------------------------------------ */

export interface DoleseTruckArrivalTile {
  ticket_id: number;
  ticket_code: string | null;
  load_cy: number;
  truck_code: string | null;
  stage_label: string;
  stage_time: string | null;
  icon: string;
}
export interface DoleseTruckArrival {
  order_id: number;
  order_code: string | null;
  order_date: string;
  subtitle: string | null;
  customer_name: string | null;
  status: OrderStatus;
  trucks: DoleseTruckArrivalTile[];
}

// Ticket-stage → vendored icon slug (the truck-status glyphs in Order_files).
// Keyed by ticketStage() labels (PRINTED / ON JOB …). The icon PNG carries its own
// baked-in caption ("TICKETED", "LOADED", "TO JOB", "AT JOB", "POURING" …). Both
// spellings are listed (TICKETED/PRINTED, AT JOB/ON JOB) since the stage labels have
// drifted in this codebase's history.
const STAGE_ICON: Record<string, string> = {
  PRINTED: "ticket_2", TICKETED: "ticket_2", LOADING: "loading_2", LOADED: "loaded_2",
  "TO JOB": "to_job_2", "ON JOB": "at_job_2", "AT JOB": "at_job_2", POURING: "pouring_2",
  POURED: "end_pour_2", WASHING: "washing_2", "TO PLANT": "to_plant_2",
  "AT PLANT": "at_plant_2", ORDERED: "order_2",
};

/**
 * Truck Arrival (D3 "TruckArrival") — the trucks currently in the delivery pipeline
 * for an order: dispatched (To Job or later) and not yet returned to the plant. One
 * tile per active truck with its latest status stamp; the NEXT TRUCK tile links here.
 */
export async function getDoleseTruckArrival(orderId: number): Promise<DoleseTruckArrival | null> {
  const supabase = await getSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, order_code, order_date, customer_name, delivery_addr1, project_name, latitude, longitude, current_status, removed, remove_reason_code, order_products(order_qty, order_qty_unit, is_mix)")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseTruckArrival:", error.message);
    return null;
  }

  const { data: tix } = await supabase.from("tickets").select(TICKET_FIELDS).eq("order_id", orderId).limit(500);
  const tickets = ((tix || []) as TicketRow[]).filter(isValidTicket);

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

  // D3's Truck Arrival shows every truck in the delivery pipeline — from TICKETED
  // through POURING — until it finishes and heads back. So: has a ticket printed and
  // has NOT finished pouring / washed / left the site / returned to plant.
  const stageRank: Record<string, number> = {
    PRINTED: 0, LOADING: 1, LOADED: 2, "TO JOB": 3, "ON JOB": 4, POURING: 5,
  };
  const isFinished = (t: TicketRow) =>
    has(t.end_unload) || has(t.wash_time) || has(t.to_plant_time) || has(t.at_plant_time);
  const inPipeline = tickets.filter((t) => has(t.printed_time) && !isFinished(t));

  // Dedup by truck: a reprint leaves a stale printed-only ticket alongside the live
  // one (e.g. truck 205446 → 40978955 printed-only + 40978957 loaded). Keep the most-
  // advanced ticket per truck (tie → the later-printed one).
  const byTruck = new Map<string, TicketRow>();
  for (const t of inPipeline) {
    const key = t.truck_code || `t${t.ticket_id}`;
    const prev = byTruck.get(key);
    if (!prev) { byTruck.set(key, t); continue; }
    const r = stageRank[ticketStage(t).label] ?? 0;
    const rp = stageRank[ticketStage(prev).label] ?? 0;
    if (r > rp || (r === rp && (t.printed_time || "") > (prev.printed_time || ""))) byTruck.set(key, t);
  }
  // Dispatch order (printed ascending) — the pouring/earliest truck leads, newest trails.
  const active = [...byTruck.values()].sort((a, b) => (a.printed_time || "").localeCompare(b.printed_time || ""));

  // ---- Live arrival ETA via Mapbox (en-route trucks) --------------------------------
  // D3 predicts a not-yet-arrived truck's arrival by routing its live GPS to the jobsite.
  // Our sync is meant to do the same into tickets.eta_data, but that pipeline's Google
  // Routes API is disabled/unbilled on its GCP project — every eta_data row is a 403 error
  // — so eta_data is unusable. We route with Mapbox instead (the token the truck map
  // already uses). Scope: trucks that have LEFT the plant (to_job_time set) but not yet
  // arrived — where a GPS route is meaningful. GPS fix time is a local-clock value in a UTC
  // field (same convention as the ticket stamps: verified location_update_time 08:24 while
  // the sync's real-UTC updated_at was 13:27), so `fix + drive` stays in that convention and
  // fmtTime renders it directly. Best-effort: any miss (no token, no/stale GPS, Mapbox error
  // or timeout) leaves the ticket out of the map and the tile falls back to the schedule.
  const mapboxEtaByTicket = new Map<number, string>();
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const jobLat = (order as { latitude?: number | null }).latitude;
  const jobLng = (order as { longitude?: number | null }).longitude;
  if (MAPBOX_TOKEN && jobLat != null && jobLng != null) {
    const enRoute = active.filter((t) => !has(t.on_job_time) && has(t.to_job_time));
    const codes = [...new Set(enRoute.map((t) => (t.truck_code || "").trim()).filter(Boolean))];
    if (codes.length) {
      const { data: gpsRows } = await supabase
        .from("trucks")
        .select("code, latitude, longitude, location_update_time")
        .in("code", codes);
      const gpsByCode = new Map(
        (gpsRows || [])
          .filter((g) => g.latitude != null && g.longitude != null)
          .map((g) => [String(g.code).trim(), g as { code: string; latitude: number; longitude: number; location_update_time: string | null }]),
      );
      const nowCstMs = nowInCstClockMs();
      await Promise.all(
        enRoute.map(async (t) => {
          const g = gpsByCode.get((t.truck_code || "").trim());
          if (!g) return;
          const fixMs = g.location_update_time ? new Date(g.location_update_time).getTime() : NaN;
          // Skip a GPS fix older than 30 min — the truck may have moved far from it.
          if (Number.isNaN(fixMs) || nowCstMs - fixMs > 30 * 60000) return;
          try {
            const url =
              `https://api.mapbox.com/directions/v5/mapbox/driving/` +
              `${g.longitude},${g.latitude};${jobLng},${jobLat}` +
              `?access_token=${MAPBOX_TOKEN}&overview=false`;
            const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
            if (!res.ok) return;
            const j = (await res.json()) as { routes?: { duration?: number }[] };
            const dur = j.routes?.[0]?.duration;
            if (typeof dur !== "number") return;
            // Floor at "now" so a truck already past its fix never shows a past clock time.
            const etaMs = Math.max(fixMs + dur * 1000, nowCstMs);
            mapboxEtaByTicket.set(t.ticket_id, new Date(etaMs).toISOString());
          } catch {
            /* timeout / network / parse error — fall back to scheduled */
          }
        }),
      );
    }
  }

  const trucks: DoleseTruckArrivalTile[] = active.map((t) => {
    const stage = ticketStage(t);
    // D3's subtitle is ALWAYS "TRUCK n ON JOB: {time}", regardless of the truck's current
    // stage. The time is its arrival on the job: the actual on_job_time once it has arrived,
    // otherwise the live Mapbox ETA (above) for en-route trucks, otherwise the scheduled
    // arrival. The icon still reflects the current stage.
    const arrivalTs = t.on_job_time || mapboxEtaByTicket.get(t.ticket_id) || t.scheduled_on_job_time;
    return {
      ticket_id: t.ticket_id,
      ticket_code: t.ticket_code,
      load_cy: Math.round((cyByTicket.get(t.ticket_id) || 0) * 100) / 100,
      truck_code: t.truck_code,
      stage_label: "ON JOB",
      stage_time: arrivalTs ? (fmtTime(arrivalTs, true) || "").replace(/\s+/g, "") : null,
      icon: STAGE_ICON[stage.label] || "order_2",
    };
  });

  const products = (order.order_products || []) as OrderProductRow[];
  const { ordered } = sumCY(products);
  const pouredOutCY = tickets.reduce((s, t) => s + (isPouredOut(t) ? cyByTicket.get(t.ticket_id) || 0 : 0), 0);
  const status = deriveStatus(order, ordered, pouredOutCY, tickets.length > 0);

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    order_date: order.order_date,
    subtitle: order.delivery_addr1 || order.project_name || null,
    customer_name: order.customer_name,
    status,
    trucks,
  };
}

/* ------------------------------------------------------------------ */
/*  5c. Truck Map (D3 "TruckMap") — active trucks + plant + jobsite    */
/* ------------------------------------------------------------------ */

export interface DoleseTruckMapRow {
  ticket_code: string | null;
  truck_code: string | null;
  driver_code: string | null;
  driver_name: string | null;
  order_code: string | null;
  product: string | null; // mix item code (e.g. A405A3)
  status: string; // "At Job" / "Pouring" / "To Job" / "Loaded" / "To Plant" …
  last_update: string | null; // clock of the latest GPS/stage update
  load_number: number; // this truck's load sequence in the order (1-based)
  volume_cy: number; // this load's CY
  shipped_cy: number; // cumulative CY delivered through this load
  plant_code: string | null;
  lat: number | null; // live GPS from the trucks table
  lng: number | null;
}
export interface DoleseTruckMap {
  order_id: number;
  order_code: string | null;
  order_date: string;
  subtitle: string | null;
  project_name: string | null;
  ordered_cy: number;
  jobsite: { lat: number; lng: number; address: string | null } | null;
  plant: { code: string | null; name: string | null; address: string | null; city: string | null; zip: string | null; lat: number; lng: number } | null;
  trucks: DoleseTruckMapRow[];
}

// Ticket stage → the status text D3's TruckMap uses (title-case stage; the marker
// colour maps "To Plant" to the pink "Returning" legend swatch client-side).
const MAP_STATUS: Record<string, string> = {
  PRINTED: "Ticketed", LOADING: "Loading", LOADED: "Loaded", "TO JOB": "To Job",
  "ON JOB": "At Job", "AT JOB": "At Job", POURING: "Pouring", POURED: "Poured",
  WASHING: "Washing", "TO PLANT": "To Plant", "AT PLANT": "At Plant",
};

/**
 * Truck Map (D3 "TruckMap") — the trucks currently out for an order, with their
 * current status, load sequence and cumulative CY shipped, plus the plant and jobsite.
 * D3 also plots each truck's live GPS on a Google map; our mirror has NO truck GPS feed
 * (there are no lat/lng columns on tickets), so the map can plot the jobsite and plant
 * (whose coords we do have) but not the trucks — the truck data lives in the table.
 * The TRUCKS "MAP" tile on the order page links here.
 */
export async function getDoleseTruckMap(orderId: number): Promise<DoleseTruckMap | null> {
  const supabase = await getSupabaseClient();

  const { data: order, error } = await supabase
    .from("orders")
    .select("order_id, order_code, order_date, delivery_addr1, delivery_addr2, delivery_addr3, project_name, latitude, longitude, pricing_plant_code, order_products(order_qty, order_qty_unit, is_mix)")
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();
  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseTruckMap:", error.message);
    return null;
  }

  // Plant coords by the order's pricing plant code.
  let plant: DoleseTruckMap["plant"] = null;
  if (order.pricing_plant_code) {
    const { data: p } = await supabase
      .from("plants")
      .select("code, description, address1, address2, address3, latitude, longitude")
      .eq("code", order.pricing_plant_code)
      .limit(1)
      .maybeSingle();
    if (p && p.latitude != null && p.longitude != null) {
      // address3 holds "State ZIP" (e.g. "Oklahoma 73448"); D3's Zip Code column shows just
      // the numeric ZIP, so pull the 5-digit (or ZIP+4) out and fall back to the raw string.
      const zipMatch = (p.address3 || "").match(/\d{5}(?:-\d{4})?/);
      plant = {
        code: p.code, name: p.description, address: p.address1 || null,
        city: p.address2 || null, zip: zipMatch ? zipMatch[0] : p.address3 || null,
        lat: Number(p.latitude), lng: Number(p.longitude),
      };
    }
  }

  type MapTicket = TicketRow & { driver_name: string | null; driver_code: string | null; plant_code: string | null };
  const { data: tix } = await supabase
    .from("tickets")
    .select(`${TICKET_FIELDS}, driver_name, driver_code, plant_code`)
    .eq("order_id", orderId)
    .limit(500);
  const tickets = ((tix || []) as MapTicket[]).filter(isValidTicket);

  const cyByTicket = new Map<number, number>();
  const mixByTicket = new Map<number, string>();
  if (tickets.length > 0) {
    const { data: tp } = await supabase
      .from("ticket_products")
      .select("ticket_id, is_mix, load_qty, order_qty_unit, item_code")
      .in("ticket_id", tickets.map((t) => t.ticket_id))
      .limit(2000);
    for (const p of tp || []) {
      if (p.is_mix === true && isCubicYardUnit(p.order_qty_unit)) {
        cyByTicket.set(p.ticket_id, (cyByTicket.get(p.ticket_id) || 0) + Number(p.load_qty || 0));
        if (p.item_code && !mixByTicket.has(p.ticket_id)) mixByTicket.set(p.ticket_id, p.item_code);
      }
    }
  }

  // Load number + cumulative shipped: number the tickets in dispatch (printed) order.
  const seq = [...tickets].sort((a, b) => (a.printed_time || "").localeCompare(b.printed_time || ""));
  const loadNo = new Map<number, number>();
  const cumCY = new Map<number, number>();
  let running = 0;
  seq.forEach((t, i) => {
    loadNo.set(t.ticket_id, i + 1);
    running += cyByTicket.get(t.ticket_id) || 0;
    cumCY.set(t.ticket_id, Math.round(running * 100) / 100);
  });

  // "On the map" = actually dispatched (LOADING or later) and not yet back AT the plant —
  // this KEEPS washing/returning ("To Plant") trucks, which D3's TruckMap shows (unlike
  // Truck Arrival). TICKETED-only trucks (printed, not yet loading) are EXCLUDED — they
  // haven't started moving. Dedup by truck, keeping the most-advanced ticket.
  const stageRank: Record<string, number> = {
    TICKETED: 0, LOADING: 1, LOADED: 2, "TO JOB": 3, "AT JOB": 4, POURING: 5, POURED: 6, WASHING: 7, "TO PLANT": 8,
  };
  const inPipeline = tickets.filter((t) => has(t.load_time) && !has(t.at_plant_time));
  const byTruck = new Map<string, MapTicket>();
  for (const t of inPipeline) {
    const key = t.truck_code || `t${t.ticket_id}`;
    const prev = byTruck.get(key);
    if (!prev) { byTruck.set(key, t); continue; }
    const r = stageRank[ticketStage(t).label] ?? 0;
    const rp = stageRank[ticketStage(prev).label] ?? 0;
    if (r > rp || (r === rp && (t.printed_time || "") > (prev.printed_time || ""))) byTruck.set(key, t);
  }
  const active = [...byTruck.values()].sort((a, b) => (loadNo.get(a.ticket_id) || 0) - (loadNo.get(b.ticket_id) || 0));

  // Live truck GPS + last-update time from the `trucks` table (joined by truck code).
  const truckCodes = active.map((t) => (t.truck_code || "").trim()).filter(Boolean);
  const gpsByTruck = new Map<string, { lat: number; lng: number; updated: string | null }>();
  if (truckCodes.length) {
    const { data: gps } = await supabase
      .from("trucks")
      .select("code, latitude, longitude, location_update_time")
      .in("code", truckCodes);
    for (const g of gps || []) {
      if (g.latitude != null && g.longitude != null) {
        gpsByTruck.set(String(g.code).trim(), {
          lat: Number(g.latitude), lng: Number(g.longitude), updated: g.location_update_time as string | null,
        });
      }
    }
  }

  const trucks: DoleseTruckMapRow[] = active.map((t) => {
    const stage = ticketStage(t);
    const code = (t.truck_code || "").trim();
    const g = gpsByTruck.get(code);
    // Prefer the GPS ping time for "Last Update" (that's what D3 shows); fall back to the
    // latest stage stamp.
    const lastUpdate = g?.updated ? fmtTime(g.updated, true) : stage.time ? fmtTime(stage.time, true) : null;
    return {
      ticket_code: t.ticket_code,
      truck_code: code || null,
      driver_code: (t.driver_code || "").trim() || null,
      driver_name: t.driver_name,
      order_code: order.order_code,
      product: mixByTicket.get(t.ticket_id) || null,
      status: MAP_STATUS[stage.label] || stage.label,
      last_update: lastUpdate ? lastUpdate.trim() : null,
      load_number: loadNo.get(t.ticket_id) || 0,
      volume_cy: Math.round((cyByTicket.get(t.ticket_id) || 0) * 100) / 100,
      shipped_cy: cumCY.get(t.ticket_id) || 0,
      plant_code: t.plant_code || plant?.code || null,
      lat: g ? g.lat : null,
      lng: g ? g.lng : null,
    };
  });

  const products = (order.order_products || []) as OrderProductRow[];
  const { ordered } = sumCY(products);

  return {
    order_id: order.order_id,
    order_code: order.order_code,
    order_date: order.order_date,
    subtitle: order.delivery_addr1 || order.project_name || null,
    project_name: order.project_name,
    ordered_cy: Math.round(ordered * 100) / 100,
    jobsite: order.latitude != null && order.longitude != null
      ? { lat: Number(order.latitude), lng: Number(order.longitude), address: order.delivery_addr1 || null }
      : null,
    plant,
    trucks,
  };
}

/* ------------------------------------------------------------------ */
/*  6. Customer (job-site) delay breakdown — one card per load        */
/* ------------------------------------------------------------------ */

export async function getDoleseCustomerDelay(orderId: number): Promise<DoleseCustomerDelay | null> {
  // D3's "<CUSTOMER> - DELAY MINUTES" page (AggCustomerDelay) breaks the customer-delay
  // tile down per load. Reuse the SAME per-load model the order-detail page already
  // computes (loadDelays), so the breakdown sums exactly to the customer-delay tile
  // (verified against 48508: 25 + 40 + 46 = 111). For each delivered load:
  //   PLAN   = spacing  — the allotted pour window (minutes)
  //   ACTUAL = spacing + Pour-Min-Over — the load's actual pour duration
  //   DELAY  = Contractor Delay (Waiting-To-Pour + Pour-Min-Over) — the customer minutes
  const detail = await getDoleseOrderDetail(orderId);
  if (!detail) return null;

  const rawLoads = detail.delay_loads.filter((l) => Math.round(l.contractor_delay) > 0);

  // D3 keeps the order's main delivery batch in arrival order and appends any out-of-batch
  // "extra" load LAST — verified against 24304, where D3 lists 24369426…24369436 then
  // 24269229 (a different ticket batch that arrived first but isn't part of the main run).
  // Partition by ticket batch (ticket minus its last 3 digits); the dominant batch keeps
  // its natural arrival order, the rest follow. Single-batch orders are unaffected.
  const batchOf = (t: string | null) => (t || "").slice(0, -3);
  const counts = new Map<string, number>();
  for (const l of rawLoads) counts.set(batchOf(l.ticket), (counts.get(batchOf(l.ticket)) || 0) + 1);
  let dominant = "";
  let bestCount = -1;
  for (const [b, c] of counts) if (c > bestCount) { bestCount = c; dominant = b; }
  const ordered = [
    ...rawLoads.filter((l) => batchOf(l.ticket) === dominant),
    ...rawLoads.filter((l) => batchOf(l.ticket) !== dominant),
  ];

  const loads: DoleseDelayLoad[] = ordered.map((l) => ({
    ticket_id: Number(l.ticket_id) || 0,
    ticket_code: l.ticket || null,
    plan_min: Math.max(0, Math.round(l.spacing)),
    delay_min: Math.max(0, Math.round(l.contractor_delay)),
    actual_min: Math.max(0, Math.round(l.spacing + l.pour_min_over)),
  }));

  const d = new Date(detail.order_date);
  const md = Number.isNaN(d.getTime()) ? "" : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

  return {
    order_id: Number(detail.order_id) || 0,
    order_code: detail.order_code,
    customer_name: detail.customer_name,
    order_line: `ORDER ${detail.order_code}${md ? `-${md}` : ""}`,
    address_line: detail.delivery_addr1 || detail.project_name || null,
    loads,
  };
}

/* ------------------------------------------------------------------ */
/*  6b. Producer (DOLESE plant) delay breakdown — one card per load   */
/* ------------------------------------------------------------------ */

export async function getDoleseProducerDelay(orderId: number): Promise<DoleseProducerDelay | null> {
  // D3's "DOLESE - DELAY MINUTES" page (AggProducerDelay) breaks the producer-delay tile
  // down per load, showing each truck's DUE (scheduled on-job) vs ARRIVED (actual on-job)
  // and its Prod Delay. Reuse the order-detail per-load model so the breakdown ties to the
  // DOLESE tile: DELAY = Prod Delay (plant lateness, floored at 0 per load).
  const detail = await getDoleseOrderDetail(orderId);
  if (!detail) return null;

  const rawLoads = detail.delay_loads.filter((l) => Math.round(l.prod_delay) > 0);

  // D3's producer page groups by the delivering truck: loads from "shuttle" trucks (which
  // made MULTIPLE trips to this order) come FIRST in delivery/ticket order, then loads from
  // single-trip trucks in REVERSE ticket order. Verified 9/9 against 24304:
  //   shuttle 205504/205360 → 24369426,429,430,432,433,436; singles → 24369425,424,24269229.
  // The odd-batch load 24269229 rides a single-trip truck, so it still lands last.
  const trips = new Map<string, number>();
  for (const l of rawLoads) trips.set(l.truck || "", (trips.get(l.truck || "") || 0) + 1);
  const tk = (l: (typeof rawLoads)[number]) => l.ticket || "";
  const shuttle = rawLoads
    .filter((l) => (trips.get(l.truck || "") || 0) >= 2)
    .sort((a, b) => tk(a).localeCompare(tk(b)));
  const single = rawLoads
    .filter((l) => (trips.get(l.truck || "") || 0) < 2)
    .sort((a, b) => tk(b).localeCompare(tk(a)));
  const ordered = [...shuttle, ...single];

  const loads: DoleseProducerDelayLoad[] = ordered.map((l) => ({
    ticket_id: Number(l.ticket_id) || 0,
    ticket_code: l.ticket || null,
    truck_code: l.truck || null,
    due: l.planned_on_job || "",
    arrived: l.actual_on_job || "",
    delay_min: Math.max(0, Math.round(l.prod_delay)),
  }));

  const d = new Date(detail.order_date);
  const md = Number.isNaN(d.getTime()) ? "" : `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

  return {
    order_id: Number(detail.order_id) || 0,
    order_code: detail.order_code,
    order_line: `ORDER ${detail.order_code}${md ? `-${md}` : ""}`,
    address_line: detail.delivery_addr1 || detail.project_name || null,
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
  /** True if the project has any user_projects rows (access-scoped) — drives the
   *  restricted vs unrestricted tile glyph. Tenant-wide binary: the app has a single
   *  shared login, so we can't compute a true per-user restriction. */
  restricted: boolean;
}

export interface OrderProjectSearch {
  customers: { id: number; name: string | null; code: string | null }[];
  projects: OrderProjectCard[];
}

interface OrderProjectRow {
  id: number;
  code: string | null;
  name: string;
  customer_name: string | null;
  customer_code: string | null;
}

export async function searchOrderProjects(q: string): Promise<OrderProjectSearch> {
  const term = q.trim().replace(/[,%()*]/g, " ").trim();

  // Get tenant-specific Supabase client
  const supabase = await getSupabaseClient();

  const PAGE_SIZE = 1000;
  let custs: { id: number; code: string | null; name: string | null }[] = [];
  let projs: OrderProjectRow[] = [];

  if (!term) {
    // Blank search → the whole book (mirrors D3's wildcard result). Paginate: the
    // customer list alone can be several thousand rows (Supabase caps a page at 1000).
    let offset = 0;
    let hasMore = true;
    while (hasMore && offset < 5000) {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, name, sort_name")
        .is("inactive", null)
        .order("sort_name", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.error("[ERROR] searchOrderProjects (customers):", error.message);
        break;
      }
      if (data && data.length) {
        custs = custs.concat(data.map((c) => ({ id: c.id, code: c.code, name: c.name })));
        offset += data.length;
        hasMore = data.length === PAGE_SIZE;
      } else hasMore = false;
    }

    offset = 0;
    hasMore = true;
    while (hasMore && offset < 8000) {
      const { data, error } = await supabase
        .from("projects")
        .select("id, code, name, customer_name, customer_code")
        .order("customer_name", { ascending: true })
        .order("name", { ascending: true })
        .range(offset, offset + PAGE_SIZE - 1);
      if (error) {
        console.error("[ERROR] searchOrderProjects (projects):", error.message);
        break;
      }
      if (data && data.length) {
        projs = projs.concat(data as OrderProjectRow[]);
        offset += data.length;
        hasMore = data.length === PAGE_SIZE;
      } else hasMore = false;
    }
  } else {
    // Term search → customers matching name/code, then their projects.
    const { data: cust, error } = await supabase
      .from("customers")
      .select("id, code, name")
      .or(`name.ilike.%${term}%,code.ilike.%${term}%`)
      .order("name", { ascending: true })
      .limit(50);
    if (error) {
      console.error("[ERROR] searchOrderProjects:", error.message);
      return { customers: [], projects: [] };
    }
    custs = cust || [];
    const custIds = custs.map((c) => c.id);
    if (!custIds.length) return { customers: [], projects: [] };

    const { data: proj } = await supabase
      .from("projects")
      .select("id, code, name, customer_name, customer_code")
      .in("customer_id", custIds)
      .order("name", { ascending: true })
      .limit(500);
    projs = (proj || []) as OrderProjectRow[];
  }

  const projIds = projs.map((p) => p.id);

  // Recent-orders count over a rolling 90-day window (D3's "Recent Orders N" is a
  // recent-window count, not all-time). Cutoff = today − 90 days.
  const counts = new Map<number, number>();
  // Restriction flag: a project with any user_projects row is access-scoped.
  const restrictedIds = new Set<number>();
  if (projIds.length) {
    const now = new Date();
    const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 90))
      .toISOString()
      .slice(0, 10);
    // Batch the id lists: a blank "show all" search yields thousands of project ids, and
    // an .in() with all of them overflows PostgREST's URL limit (the query then silently
    // returns nothing). Chunk so each request stays well under the limit.
    const CHUNK = 300;
    const chunks: number[][] = [];
    for (let i = 0; i < projIds.length; i += CHUNK) chunks.push(projIds.slice(i, i + CHUNK));
    await Promise.all(
      chunks.map(async (ids) => {
        const [ordersRes, userProjRes] = await Promise.all([
          supabase.from("orders").select("project_id").in("project_id", ids).gte("order_date", cutoff).limit(20000),
          supabase.from("user_projects").select("project_id").in("project_id", ids).limit(20000),
        ]);
        for (const o of ordersRes.data || []) {
          if (o.project_id != null) counts.set(o.project_id, (counts.get(o.project_id) || 0) + 1);
        }
        for (const up of userProjRes.data || []) {
          if (up.project_id != null) restrictedIds.add(up.project_id);
        }
      }),
    );
  }

  const projects: OrderProjectCard[] = projs.map((p) => ({
    project_id: p.id,
    project_name: p.name,
    project_code: p.code,
    customer_name: p.customer_name,
    customer_code: p.customer_code,
    recent_orders: counts.get(p.id) || 0,
    restricted: restrictedIds.has(p.id),
  }));

  return {
    customers: custs.map((c) => ({ id: c.id, name: c.name, code: c.code })),
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

export interface ReferencedOrderOption {
  order_id: number;
  order_code: string;
  /** "APR 16 @ 8:00AM, 401 N 4TH AVE, ORDER # 48301" */
  label: string;
}

/** "APR 16 @ 8:00AM" — start_time is a CST clock stored in a UTC field, so read UTC parts. */
function fmtReferenceStamp(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  let h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ap = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${MONTHS[d.getUTCMonth()].toUpperCase()} ${d.getUTCDate()} @ ${h}:${String(m).padStart(2, "0")}${ap}`;
}

/**
 * Recent orders for the Order Request Form's "Referenced Order" dropdown (#2). Scoped to
 * the WHOLE customer (all its projects), newest first — matches D3's multi-address list.
 * Resolve the customer from the project (or take it directly on the customer path), gather
 * that customer's project ids, then the most recent orders across them.
 */
export async function getReferencedOrders(opts: {
  projectId?: number;
  customerId?: number;
}): Promise<ReferencedOrderOption[]> {
  const supabase = await getSupabaseClient();

  let customerId = opts.customerId ?? null;
  if (!customerId && opts.projectId) {
    const { data: p } = await supabase
      .from("projects")
      .select("customer_id")
      .eq("id", opts.projectId)
      .maybeSingle();
    customerId = (p as { customer_id?: number } | null)?.customer_id ?? null;
  }
  if (!customerId) return [];

  const { data: projs } = await supabase
    .from("projects")
    .select("id")
    .eq("customer_id", customerId)
    .limit(2000);
  const projIds = (projs || []).map((p) => p.id);
  if (!projIds.length) return [];

  // Newest orders across the customer's projects. Chunk the id list so a customer with
  // many projects doesn't overflow the .in() URL limit.
  type RefRow = {
    order_id: number;
    order_code: string | null;
    order_date: string | null;
    delivery_addr1: string | null;
    order_products?: { order_product_schedules?: { start_time: string | null }[] }[] | null;
  };
  const CHUNK = 300;
  let rows: RefRow[] = [];
  for (let i = 0; i < projIds.length; i += CHUNK) {
    const ids = projIds.slice(i, i + CHUNK);
    const { data } = await supabase
      .from("orders")
      .select("order_id, order_code, order_date, delivery_addr1, order_products(order_product_schedules(start_time))")
      .in("project_id", ids)
      .order("order_date", { ascending: false })
      .limit(50);
    if (data) rows = rows.concat(data as unknown as RefRow[]);
  }

  rows.sort((a, b) => String(b.order_date || "").localeCompare(String(a.order_date || "")));

  return rows.slice(0, 15).map((o) => {
    const start = earliestStart((o.order_products || []) as OrderProductRow[]);
    const stamp = fmtReferenceStamp(start || o.order_date);
    const addr = (o.delivery_addr1 || "").toUpperCase();
    const label = [stamp, addr, `ORDER # ${o.order_code || ""}`].filter(Boolean).join(", ");
    return { order_id: o.order_id, order_code: o.order_code || "", label };
  });
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
    restricted: false, // Not computed here (searchOrderProjects derives the real flag)
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

  // Production returns ALL active companies when SEARCH is clicked.
  // The client-side "Search" filter handles filtering by text.
  const { data: custs, error } = await supabase
    .from("customers")
    .select("id, code, name, sort_name")
    .is("inactive", null)
    .order("sort_name", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("[ERROR] searchCompanies:", error.message);
    return [];
  }

  if (!custs || custs.length === 0) return [];

  const custIds = custs.map((c) => c.id);

  // Get project counts
  const projectCountMap = new Map<number, number>();
  if (custIds.length) {
    const { data: projLinks } = await supabase
      .from("projects")
      .select("customer_id")
      .in("customer_id", custIds);
    for (const p of projLinks || []) {
      if (p.customer_id != null) {
        projectCountMap.set(p.customer_id, (projectCountMap.get(p.customer_id) || 0) + 1);
      }
    }
  }

  // Get user counts from user_customers table
  const userCountMap = new Map<number, number>();
  if (custIds.length) {
    const { data: userLinks } = await supabase
      .from("user_customers")
      .select("customer_id")
      .in("customer_id", custIds)
      .limit(5000);
    for (const l of userLinks || []) {
      if (l.customer_id != null) {
        userCountMap.set(l.customer_id, (userCountMap.get(l.customer_id) || 0) + 1);
      }
    }
  }

  return custs.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
    project_count: projectCountMap.get(c.id) || 0,
    user_count: userCountMap.get(c.id) || 0,
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

  // Production returns ALL projects when SEARCH is clicked.
  const { data: projs, error } = await supabase
    .from("projects")
    .select("id, code, name, customer_name")
    .order("name", { ascending: true })
    .limit(2000);

  if (error) {
    console.error("[ERROR] searchProjectsByName:", error.message);
    return [];
  }

  if (!projs || projs.length === 0) return [];

  // Get user counts from user_projects table
  const projIds = projs.map((p) => p.id);
  const userCountMap = new Map<number, number>();
  if (projIds.length) {
    const { data: userLinks } = await supabase
      .from("user_projects")
      .select("project_id")
      .in("project_id", projIds)
      .limit(5000);
    for (const l of userLinks || []) {
      if (l.project_id != null) {
        userCountMap.set(l.project_id, (userCountMap.get(l.project_id) || 0) + 1);
      }
    }
  }

  return projs.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code,
    customer_name: p.customer_name,
    user_count: userCountMap.get(p.id) || 0,
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
  // D3 request states → tile colour: active (Restarted, blue), scheduled
  // (Scheduled, green), cancelled (Cancelled, red).
  status: "active" | "scheduled" | "cancelled";
}

/** Rolling window [today − days, today + days] as [from, toExclusive) date strings. */
function rollingWindow(days: number): { from: string; to: string } {
  const today = new Date().toISOString().slice(0, 10);
  const [y, m, d] = today.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, d - days)).toISOString().slice(0, 10);
  // toExclusive is the day AFTER the last day we want to include (+days), so use lt().
  const to = new Date(Date.UTC(y, m - 1, d + days + 1)).toISOString().slice(0, 10);
  return { from, to };
}

interface OrderRequestRow {
  order_id: number | string;
  order_code: string | null;
  order_date: string | null;
  customer_name: string | null;
  delivery_addr1: string | null;
  project_name: string | null;
  current_status: number | null;
  removed: boolean | null;
  remove_reason_code: string | null;
  order_products: (OrderProductRow & { order_product_schedules?: { start_time: string | null }[] })[];
}

export async function getOrderRequests(): Promise<OrderRequestItem[]> {
  const [supabase, exclusionPatterns] = await Promise.all([
    getSupabaseClient(),
    getExcludedPatterns(),
  ]);

  // The Order Request Dashboard is a rolling queue of open requests, NOT a single day —
  // the D3 snapshot's start_times span weeks around today. Use a ±2-week window on
  // order_date (a full timestamp) via a [from, next-day-after-to) range.
  const { from, to } = rollingWindow(14);

  // Paginate: the Supabase default cap is 1000 and a two-week window can exceed 100
  // (the old limit silently truncated the board, dropping orders).
  const PAGE_SIZE = 1000;
  let allOrders: OrderRequestRow[] = [];
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products(order_qty, order_qty_unit, is_mix, item_code, order_product_schedules(start_time))"
      )
      .gte("order_date", from)
      .lt("order_date", to)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("[ERROR] getOrderRequests:", error.message);
      break;
    }
    if (data && data.length > 0) {
      allOrders = allOrders.concat(data as unknown as OrderRequestRow[]);
      offset += data.length;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }

  // Keep only OPEN requests with a cubic-yard mix product. Two filters:
  //  - Cubic-yard: accept CY, YDQ, … via the shared helper (an exact "CY" match dropped
  //    YDQ-unit tenants).
  //  - Open: drop Completed orders (current_status 4). The request board is a queue of
  //    live requests — the D3 snapshot has NO "completed" category (only Restarted /
  //    Scheduled / Cancelled), so a finished order falls off the board.
  const cyOrders = allOrders.filter(
    (o) =>
      Number(o.current_status) !== 4 &&
      (o.order_products || []).some((p) => isCubicYardUnit(p.order_qty_unit)),
  );

  // Apply the same exclusion-pattern filtering as the rest of the board (matches D3).
  const filteredOrders = filterExcludedOrders(
    cyOrders.map((o) => ({
      order_id: Number(o.order_id),
      order_code: o.order_code || "",
      customer_name: o.customer_name,
      delivery_addr1: o.delivery_addr1,
      order_products: o.order_products,
    })),
    exclusionPatterns,
  );
  const keptIds = new Set(filteredOrders.map((o) => o.order_id));

  const items = cyOrders
    .filter((o) => keptIds.has(Number(o.order_id)))
    .map((o) => {
      const products = (o.order_products || []) as (OrderProductRow & {
        order_product_schedules?: { start_time: string | null }[];
      })[];

      let orderedCY = 0;
      for (const p of products) {
        if (p.is_mix && isCubicYardUnit(p.order_qty_unit)) {
          orderedCY += Number(p.order_qty || 0);
        }
      }

      // Raw earliest scheduled start — the sort key (untimed → sorts last) and the source
      // of the "M/D HH:MM" label shown on the tile.
      const startRaw = earliestStart(products);
      let formattedTime = "";
      if (startRaw) {
        const d = new Date(startRaw);
        formattedTime = `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
      }

      // Map dispatch current_status → request-tile colour (matches D3's
      // DoleseOrderRequestDashboardV2). Uses the same code scheme as DISPATCH_STATUS_LABELS:
      //   removed / 5 (Cancelled) → red "Cancelled"
      //   2 (Active, in-process)  → blue "Restarted"
      //   else (0 Firm / 1 W/C / 3 Hold / null, i.e. not yet started) → green "Scheduled".
      // Completed (4) orders were already filtered off the board above.
      const cs = Number(o.current_status);
      const isCancelled = o.removed === true || cs === 5;
      const status: OrderRequestItem["status"] = isCancelled
        ? "cancelled"
        : cs === 2
          ? "active"
          : "scheduled";

      return {
        item: {
          order_id: o.order_id,
          order_code: o.order_code || "",
          order_date: o.order_date || "",
          start_time: formattedTime || null,
          ordered_cy: Math.round(orderedCY * 100) / 100,
          address: o.delivery_addr1 || o.project_name || null,
          customer_name: o.customer_name || null,
          status,
        } as OrderRequestItem,
        // Sort key: CST clock value stored in a UTC field; untimed (will-call) → last.
        sortKey: startRaw ? new Date(startRaw).getTime() : Number.POSITIVE_INFINITY,
      };
    });

  // Order the board by scheduled start ascending. The client groups by status (stable
  // sort), so within each status group tiles stay in this chronological order.
  items.sort((a, b) => a.sortKey - b.sortKey);
  return items.map((i) => i.item);
}
