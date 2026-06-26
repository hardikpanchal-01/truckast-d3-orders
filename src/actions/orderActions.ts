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
  order_id: number;
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

export interface DoleseOrderDetail {
  order_id: number;
  order_code: string;
  order_date: string;
  customer_name: string | null;
  delivery_addr1: string | null;
  delivery_addr2: string | null;
  delivery_addr3: string | null;
  project_name: string | null;
  zone_name: string | null;
  plant_code: string | null;
  status: OrderStatus;
  ordered_cy: number;
  ticketed_cy: number;
  on_job_cy: number;
  loads: number;
  trucks: number;
  next_truck: string | null;
  pour_finish: string | null;
  weather: { temp?: string; description?: string; place?: string } | null;
  pour_series: { time: string; ordered: number; delivered: number }[];
}

/* ------------------------------------------------------------------ */
/*  Product / CY helpers                                              */
/* ------------------------------------------------------------------ */

interface OrderProductRow {
  order_qty: number | null;
  order_qty_unit: string | null;
  delv_qty: number | string | null;
  is_mix: boolean | null;
  order_product_schedules?: { start_time: string | null }[] | null;
}

function sumCY(products: OrderProductRow[] | null | undefined) {
  let ordered = 0;
  let ticketed = 0;
  for (const p of products || []) {
    if (p.order_qty_unit === "CY" && p.is_mix === true) {
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
  return has(t.wash_time) || has(t.unload_time) || has(t.end_unload) || has(t.to_plant_time) || has(t.at_plant_time);
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

/* ------------------------------------------------------------------ */
/*  Date / time formatting                                           */
/* ------------------------------------------------------------------ */

function dayRange(dateStr: string) {
  return { from: `${dateStr}T00:00:00Z`, to: `${dateStr}T23:59:59Z` };
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

export async function getToday(): Promise<string> {
  return new Date().toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ */
/*  1. Market summary (business-unit aggregate)                        */
/* ------------------------------------------------------------------ */

export async function getDoleseSummary(dateStr: string): Promise<DoleseSummary> {
  const { from, to } = dayRange(dateStr);
  const { data, error } = await supabaseServer
    .from("orders")
    .select("order_id, removed, remove_reason_code, order_products!inner(order_qty, order_qty_unit, delv_qty, is_mix)")
    .gte("order_date", from)
    .lte("order_date", to);

  if (error) {
    console.error("[ERROR] getDoleseSummary:", error.message);
    return { name: "DOLESE", usedCY: 0, totalCY: 0, totalOrders: 0, activeOrders: 0, cancelledOrders: 0 };
  }

  let totalCY = 0, usedCY = 0, totalOrders = 0, activeOrders = 0, cancelledOrders = 0;
  for (const o of data || []) {
    const products = (o.order_products || []) as OrderProductRow[];
    if (!products.some((p) => p.order_qty_unit === "CY" && p.is_mix === true)) continue;
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
    name: "DOLESE",
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
  const { data, error } = await supabaseServer
    .from("orders")
    .select(
      "order_id, order_code, order_date, customer_name, delivery_addr1, project_name, current_status, removed, remove_reason_code, order_products!inner(order_qty, order_qty_unit, delv_qty, is_mix, order_product_schedules(start_time))",
    )
    .gte("order_date", from)
    .lte("order_date", to)
    .order("order_date", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("[ERROR] getDoleseOrders:", error.message);
    return [];
  }

  const rows = (data || []).filter((o) =>
    ((o.order_products || []) as OrderProductRow[]).some((p) => p.order_qty_unit === "CY" && p.is_mix === true),
  );

  const items: DoleseOrderListItem[] = rows.map((o) => {
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

export async function getDoleseOrderDetail(orderId: number): Promise<DoleseOrderDetail | null> {
  const { data: order, error } = await supabaseServer
    .from("orders")
    .select(
      "order_id, order_code, order_date, customer_name, delivery_addr1, delivery_addr2, delivery_addr3, project_name, zone_name, pricing_plant_code, current_status, removed, remove_reason_code, weather_data, order_products(order_qty, order_qty_unit, delv_qty, is_mix, order_product_schedules(start_time))",
    )
    .eq("order_id", orderId)
    .limit(1)
    .maybeSingle();

  if (error || !order) {
    if (error) console.error("[ERROR] getDoleseOrderDetail:", error.message);
    return null;
  }

  const products = (order.order_products || []) as OrderProductRow[];
  const { ordered, ticketed } = sumCY(products);

  // Tickets joined by order_id (the reliable key).
  const { data: tix } = await supabaseServer
    .from("tickets")
    .select(TICKET_FIELDS)
    .eq("order_id", orderId)
    .limit(500);
  const tickets = ((tix || []) as TicketRow[]).filter(isValidTicket);

  // Delivered CY per ticket = sum of mix ticket_products.load_qty (CY).
  const cyByTicket = new Map<number, number>();
  if (tickets.length > 0) {
    const { data: tp } = await supabaseServer
      .from("ticket_products")
      .select("ticket_id, is_mix, load_qty, order_qty_unit")
      .in("ticket_id", tickets.map((t) => t.ticket_id))
      .limit(2000);
    for (const p of tp || []) {
      if (p.is_mix === true && p.order_qty_unit === "CY") {
        cyByTicket.set(p.ticket_id, (cyByTicket.get(p.ticket_id) || 0) + Number(p.load_qty || 0));
      }
    }
  }

  const loads = tickets.length;
  const trucks = new Set(tickets.map((t) => t.truck_code).filter(Boolean)).size;

  // On job = delivered loads that have arrived but not yet poured out.
  const onJobCY = tickets
    .filter((t) => has(t.on_job_time) && !isPouredOut(t))
    .reduce((s, t) => s + (cyByTicket.get(t.ticket_id) || 0), 0);

  // Pour series: cumulative delivered over on-job times.
  const timed = tickets
    .filter((t) => has(t.on_job_time))
    .sort((a, b) => (a.on_job_time || "").localeCompare(b.on_job_time || ""));
  let cum = 0;
  const pour_series = timed.map((t) => {
    cum += cyByTicket.get(t.ticket_id) || 0;
    return { time: fmtTime(t.on_job_time, true) || "", ordered, delivered: Math.round(cum * 100) / 100 };
  });

  const lastTicket = tickets.length
    ? tickets.reduce((a, b) => ((b.ticket_code || "") > (a.ticket_code || "") ? b : a))
    : null;
  const status = deriveStatus(order, ordered, ticketed, lastTicket ? isTicketCompleted(lastTicket) : false);

  const pourFinishRaw = tickets
    .map((t) => t.end_unload || t.unload_time || t.wash_time)
    .filter((x): x is string => !!x)
    .sort();
  const pourFinish = pourFinishRaw.length ? fmtTime(pourFinishRaw[pourFinishRaw.length - 1], true) : null;

  const nextTruck = status === "COMPLETED" ? null : fmtTime(earliestStart(products), true);

  // Weather (JSONB shape varies; best-effort)
  let weather: DoleseOrderDetail["weather"] = null;
  const w = order.weather_data as Record<string, unknown> | null;
  if (w && typeof w === "object") {
    const temp =
      (w.temperature as number | string | undefined) ??
      (w.temp as number | string | undefined) ??
      ((w.main as Record<string, unknown>)?.temp as number | undefined);
    const desc =
      (w.description as string | undefined) ??
      (Array.isArray(w.weather) ? ((w.weather[0] as Record<string, unknown>)?.description as string) : undefined);
    if (temp != null || desc) {
      weather = {
        temp: temp != null ? `${typeof temp === "number" ? Math.round(temp) : temp}°F` : undefined,
        description: desc,
        place: order.pricing_plant_code || undefined,
      };
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
    status,
    ordered_cy: Math.round(ordered * 100) / 100,
    ticketed_cy: Math.round(ticketed * 100) / 100,
    on_job_cy: Math.round(onJobCY * 100) / 100,
    loads,
    trucks,
    next_truck: nextTruck,
    pour_finish: pourFinish,
    weather,
    pour_series,
  };
}
