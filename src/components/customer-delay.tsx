"use client";

import * as React from "react";
import Link from "next/link";
import { FoldCard, SearchBox } from "@/components/d3-ui";
import type { DoleseDelayLoad } from "@/actions/orderActions";

function DelayCard({ load, orderId }: { load: DoleseDelayLoad; orderId: number }) {
  return (
    <Link href={`/orders/${orderId}/tickets/${load.ticket_id}`} className="block">
      <FoldCard tone="red" className="h-[90px] w-[274px] cursor-pointer text-white">
        <div className="flex h-full items-center gap-2 p-1">
          <div className="flex h-[82px] w-[72px] shrink-0 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://d3.truckast.com/Images/icons/contractor.png"
              alt="Contractor"
              className="h-[82px] w-[72px] object-contain"
            />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-[14px] opacity-95">PLAN: {load.plan_min} MINUTE(S)</p>
            <p className="truncate text-[16px] font-bold leading-tight">
              {load.ticket_code ?? "—"}: {load.delay_min} MIN DELAY
            </p>
            <p className="truncate text-[12px] opacity-90">ACTUAL: {load.actual_min} MINUTE(S)</p>
          </div>
        </div>
      </FoldCard>
    </Link>
  );
}

export function CustomerDelayList({ loads, orderId }: { loads: DoleseDelayLoad[]; orderId: number }) {
  const [q, setQ] = React.useState("");

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return loads;
    return loads.filter((l) =>
      [l.ticket_code, `${l.delay_min}`, `${l.actual_min}`]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [loads, q]);

  return (
    <div className="space-y-3">
      <SearchBox value={q} onChange={setQ} placeholder="Search" />
      {filtered.length === 0 ? (
        <p className="text-sm text-[#777]">No delays for this order.</p>
      ) : (
        <div className="flex flex-wrap gap-[10px]">
          {filtered.map((l) => (
            <DelayCard key={l.ticket_id} load={l} orderId={orderId} />
          ))}
        </div>
      )}
    </div>
  );
}
