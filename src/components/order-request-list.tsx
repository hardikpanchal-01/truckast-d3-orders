"use client";

import { useState } from "react";
import { SearchBox, FoldCard } from "@/components/d3-ui";
import type { OrderRequestItem } from "@/actions/orderActions";

function SyncIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 24a16 16 0 0 1 27.3-11.3" />
      <polyline points="32 8 36 13 31 17" />
      <path d="M40 24a16 16 0 0 1-27.3 11.3" />
      <polyline points="16 40 12 35 17 31" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="10" width="36" height="32" rx="3" />
      <line x1="6" y1="18" x2="42" y2="18" />
      <line x1="16" y1="6" x2="16" y2="14" />
      <line x1="32" y1="6" x2="32" y2="14" />
      <line x1="14" y1="26" x2="22" y2="26" />
      <line x1="14" y1="34" x2="22" y2="34" />
      <line x1="26" y1="26" x2="34" y2="26" />
      <line x1="26" y1="34" x2="34" y2="34" />
    </svg>
  );
}

function OrderRequestTile({ order }: { order: OrderRequestItem }) {
  const tone = order.status === "active" ? "green" : "blue";
  const Icon = order.status === "active" ? SyncIcon : CalendarIcon;

  return (
    <div
      className="relative block cursor-pointer text-white"
      style={{
        width: 274,
        height: 90,
        marginRight: 5,
        marginBottom: 5,
        float: "left",
      }}
    >
      <FoldCard tone={tone} className="h-full w-full">
        <div className="flex h-full w-full items-center">
          <div className="flex h-full w-[72px] shrink-0 items-center justify-center">
            <Icon className="h-10 w-10" />
          </div>
          <div className="flex min-w-0 flex-1 items-center pr-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] leading-[1.2] text-white/90">
                {order.order_code}: {order.start_time || order.order_date} - {order.ordered_cy.toFixed(2)} CY
              </div>
              <div className="truncate text-[16px] font-bold leading-[1.2] text-white">
                {order.address || "—"}
              </div>
              <div className="truncate text-[12px] leading-[1.2] text-white/90">
                {order.customer_name || "\u00A0"}
              </div>
            </div>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}

export function OrderRequestList({ orders }: { orders: OrderRequestItem[] }) {
  const [search, setSearch] = useState("");

  const filteredOrders = orders.filter((order) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      order.order_code.toLowerCase().includes(q) ||
      order.address?.toLowerCase().includes(q) ||
      order.customer_name?.toLowerCase().includes(q)
    );
  });

  return (
    <>
      <SearchBox value={search} onChange={setSearch} placeholder="Search" />

      <div className="flex flex-wrap">
        {filteredOrders.map((order) => (
          <OrderRequestTile key={order.order_id} order={order} />
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <p className="py-10 text-center text-sm text-slate-400">
          No order requests found.
        </p>
      )}
    </>
  );
}
