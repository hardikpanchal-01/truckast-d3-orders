"use client";

import * as React from "react";
import Link from "next/link";
import { FoldCard, LoadStatusIcon, SearchBox } from "@/components/d3-ui";
import type { DoleseLoad } from "@/actions/orderActions";

/** Live status glyph, e.g. "AT PLANT" -> /images/icons/at_plant_2.png. */
function statusIconUrl(status: string): string {
  const slug = status.toLowerCase().replace(/\s+/g, "_");
  return `https://d3.truckast.com/images/icons/${slug}_2.png`;
}

function LoadCard({ load, orderId }: { load: DoleseLoad; orderId: number }) {
  const [iconBroken, setIconBroken] = React.useState(false);
  return (
    <Link href={`/orders/${orderId}/tickets/${load.ticket_id}`} className="block">
    <FoldCard tone="blue" className="h-[90px] w-full cursor-pointer text-white sm:w-[274px]">
      <div className="flex h-full items-center gap-2 p-1">
        <div className="relative h-[82px] w-[72px] shrink-0">
          {iconBroken ? (
            <>
              {/* SVG fallback has no baked-in text, so add the status label here */}
              <LoadStatusIcon className="h-[82px] w-[72px]" />
              <span className="absolute bottom-0 left-1 text-[10px] font-bold uppercase tracking-wide">
                {load.status}
              </span>
            </>
          ) : (
            // The d3 status icon already includes the status text in the image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={statusIconUrl(load.status)}
              alt={load.status}
              className="h-[82px] w-[72px] object-contain"
              onError={() => setIconBroken(true)}
            />
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[12px] font-semibold">LOAD # {load.load_no}</p>
          <p className="truncate text-[12px] opacity-95">
            TRUCK {load.truck_code ?? "—"}{load.plant_name ? ` - ${load.plant_name}` : ""}
          </p>
          <p className="text-[13px] font-bold">
            {load.ticket_code ?? "—"}: {load.load_cy.toFixed(2)} CY
          </p>
          <p className="text-[11px] opacity-95">
            {load.status_time ? `${load.status_time} ` : ""}
            {load.cumulative_cy.toFixed(2)} OF {load.total_cy.toFixed(2)} CY
          </p>
        </div>
      </div>
    </FoldCard>
    </Link>
  );
}

export function TicketSummaryList({ loads, orderId }: { loads: DoleseLoad[]; orderId: number }) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return loads;
    return loads.filter((l) =>
      [
        `load # ${l.load_no}`,
        l.ticket_code,
        l.truck_code,
        l.plant_name,
        l.status,
      ]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [loads, q]);

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      {filtered.length === 0 ? (
        <p className="text-sm text-[#777]">No loads for this order.</p>
      ) : (
        <div className="flex flex-wrap gap-[10px]">
          {filtered.map((l) => (
            <LoadCard key={l.ticket_id} load={l} orderId={orderId} />
          ))}
        </div>
      )}
    </div>
  );
}
