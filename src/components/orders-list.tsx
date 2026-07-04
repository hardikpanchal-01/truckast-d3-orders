"use client";

import * as React from "react";
import { SearchBox, IconTile, PieGauge, type ToneName } from "@/components/d3-ui";
import type { DoleseOrderListItem, OrderStatus } from "@/actions/orderActions";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

/**
 * Card colour rules (from the live app):
 *  Green  – Firm order while PRE-POUR; or IN_PROCESS/COMPLETE with poured speed ≥ 90% of plan.
 *  Yellow – Will-Call order while PRE-POUR; or IN_PROCESS/COMPLETE with poured speed 60–89%.
 *  Red    – Cancelled or on-hold order; or IN_PROCESS/COMPLETE with poured speed < 60%.
 */
function cardTone(o: DoleseOrderListItem): ToneName {
  const ds = o.dispatch_status;
  if (o.status === "CANCELED" || ds === "Cancelled" || ds === "Hold") return "red";
  if (o.status === "PRE_POUR") {
    // D3 paints pre-pour orders yellow (Will-Call) unless dispatch has firmed them.
    // In DOLESE's data every pre-pour order comes back current_status = 1, which D3
    // treats as Will-Call → yellow. A firmed order is flagged current_status = 2 ("Active").
    // (We can't confirm the exact code table without prod-DB access, but this matches D3.)
    return ds === "Active" ? "green" : "yellow";
  }
  // IN_PROCESS / COMPLETE → poured speed vs planned speed.
  const pct = o.pour_pct;
  if (pct == null) return "green"; // no pour data yet → treat as on-plan
  if (pct >= 90) return "green";
  if (pct >= 60) return "yellow";
  return "red";
}

/** D3 shows CY as 0.00 until an order reaches a full 1 CY (sub-1 values display as zero). */
function cyLabel(cy: number): string {
  return (cy < 1 ? 0 : cy).toFixed(2);
}

function md(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** start_time is a CST clock value stored in a UTC field → read UTC parts as HH:MM. */
function startLabel(t: string | null): string {
  if (!t) return "";
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function OrdersList({ orders }: { orders: DoleseOrderListItem[] }) {
  const [filter, setFilter] = React.useState("");

  const visible = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.order_code?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.delivery_addr1?.toLowerCase().includes(q) ||
        o.project_name?.toLowerCase().includes(q),
    );
  }, [orders, filter]);

  // space-y-3 keeps the search → tiles gap tight (matching D3).
  return (
    <div className="space-y-3 pt-2">
      <SearchBox value={filter} onChange={setFilter} placeholder="Search" />

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No orders for this day.</p>
      ) : (
        <div className="flex flex-wrap">
          {visible.map((o) => {
            const tone = cardTone(o);
            const isCompleted = o.status === "COMPLETED";
            const usePie = o.status === "IN_PROCESS";
            const pct = o.ordered_cy > 0 ? o.ticketed_cy / o.ordered_cy : 0;
            // Only PRE-POUR tiles lead with the scheduled time (matches the live app).
            const start = o.status === "PRE_POUR" ? startLabel(o.start_time) : "";
            // D3 renders the address + customer lines UPPERCASE on the tiles.
            const boldLine = [start, o.delivery_addr1 || o.project_name || "—"].filter(Boolean).join(" ").toUpperCase();
            return (
              <IconTile
                key={o.order_id}
                href={`/orders/${o.order_id}`}
                tone={tone}
                completed={isCompleted}
                left={
                  usePie ? (
                    <PieGauge pct={pct} size={52} tinted />
                  ) : o.status === "CANCELED" ? (
                    // D3's cancelled-tile glyph (white ⊘ on transparent), 72×80.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/icons/cancelled.png" alt="Cancelled" width={72} height={80} />
                  ) : !isCompleted ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src="/icons/scheduled.png" alt="" className="h-[64px] w-auto" />
                  ) : undefined
                }
                lines={[
                  {
                    text: `${o.order_code}-${md(o.order_date)}: ${cyLabel(o.ordered_cy)} CY (${STATUS_LABEL[o.status]})`,
                    size: 14,
                    dim: true,
                  },
                  { text: boldLine, bold: true, size: 16 },
                  { text: (o.customer_name || "—").toUpperCase(), size: 12, dim: true },
                ]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
