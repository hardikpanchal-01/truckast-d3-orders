"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";
import { SearchBox, IconTile, PieGauge, type ToneName } from "@/components/d3-ui";
import type { DoleseOrderListItem, OrderStatus } from "@/actions/orderActions";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

const STATUS_TONE: Record<OrderStatus, ToneName> = {
  IN_PROCESS: "green",
  PRE_POUR: "orange",
  COMPLETED: "green", // poured-out orders read green in the live app
  CANCELED: "red",
};

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

  return (
    <div className="space-y-3">
      <SearchBox value={filter} onChange={setFilter} placeholder="Search" className="sm:max-w-xs" />

      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No orders for this day.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((o) => {
            const tone = STATUS_TONE[o.status];
            const usePie = o.status === "IN_PROCESS" || o.status === "COMPLETED";
            const pct = o.ordered_cy > 0 ? o.ticketed_cy / o.ordered_cy : 0;
            // Only PRE-POUR tiles lead with the scheduled time (matches the live app).
            const start = o.status === "PRE_POUR" ? startLabel(o.start_time) : "";
            const boldLine = [start, o.delivery_addr1 || o.project_name || "—"].filter(Boolean).join(" ");
            return (
              <IconTile
                key={o.order_id}
                href={`/orders/${o.order_id}`}
                tone={tone}
                left={usePie ? <PieGauge pct={pct} size={52} /> : undefined}
                icon={usePie ? undefined : CalendarDays}
                lines={[
                  {
                    text: `${o.order_code}-${md(o.order_date)}: ${o.ordered_cy.toFixed(2)} CY (${STATUS_LABEL[o.status]})`,
                    size: 11,
                    dim: true,
                  },
                  { text: boldLine, bold: true },
                  { text: o.customer_name || "—", size: 10, dim: true },
                ]}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
