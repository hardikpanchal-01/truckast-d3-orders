"use client";

import * as React from "react";
import Link from "next/link";
import { SearchBox, IconTile, FoldCard, PieGauge } from "@/components/d3-ui";
import type { DoleseSummary } from "@/actions/orderActions";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function MarketTiles({ summary, dateStr }: { summary: DoleseSummary; dateStr: string }) {
  const [q, setQ] = React.useState("");
  const needle = q.trim().toLowerCase();

  // If total is <= 1, show as 100% complete (blue). Otherwise calculate the delivered percentage.
  const pct = summary.totalCY > 1 ? summary.usedCY / summary.totalCY : 1;

  // Each tile carries searchable text so the box filters them.
  const fuelText = "current fuel surcharge dolese";
  const doleseText = summary.name.toLowerCase();
  const showFuel = !needle || fuelText.includes(needle);
  const showDolese = !needle || doleseText.includes(needle);

  return (
    <div>
      <div className="mb-[10px]">
        <SearchBox value={q} onChange={setQ} placeholder="Search" />
      </div>

      <div className="flex flex-wrap">
        {showFuel && (
          <Link href="/fuel-surcharges" className="mb-[5px] block w-full sm:mr-[5px] sm:w-[274px]">
            <FoldCard tone="red" style={{ backgroundColor: "#ED1C24" }} className="w-full cursor-pointer text-white">
              <div className="flex h-[90px] items-center gap-2 py-2 pl-2 pr-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://d3.truckast.com/Images/logos/dolesepublish.png"
                  alt=""
                  style={{ width: 72, height: 69 }}
                  className="shrink-0"
                />
                <div className="min-w-0 leading-tight">
                  <p className="truncate text-[13px] opacity-90">June 22nd thru 26th, 2026</p>
                  <p className="truncate text-[15px] font-bold">Current Fuel Surcharge</p>
                  <p className="text-[12px] leading-tight opacity-90">$30.00 per load *Click for Details</p>
                </div>
              </div>
            </FoldCard>
          </Link>
        )}

        {showDolese && (
          <IconTile
            tone="green"
            href={`/orders?date=${dateStr}`}
            left={<div style={{ marginLeft: 10, marginRight: 10 }}><PieGauge pct={pct} size={60} /></div>}
            lines={[
              { text: summary.name.split(" ")[0].toUpperCase(), size: 14 },
              { text: `${fmt(summary.usedCY)} OF ${fmt(summary.totalCY)} CY`, bold: true, size: 16 },
              {
                text: `Tot ${summary.totalOrders}, Act ${summary.activeOrders}, Can ${summary.cancelledOrders}`,
                size: 12,
                dim: true,
              },
            ]}
          />
        )}

        {!showFuel && !showDolese && <p className="py-6 text-sm text-[#777]">No results.</p>}
      </div>
    </div>
  );
}
