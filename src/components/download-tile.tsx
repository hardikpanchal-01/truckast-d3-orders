"use client";

import { FoldCard } from "@/components/d3-ui";

export function DownloadTile({ date }: { date: string }) {
  const handleDownload = () => {
    window.location.href = `/api/orders/export?date=${date}`;
  };

  return (
    <div className="flex">
      <FoldCard
        tone="green"
        className="mb-[5px] mr-[5px] w-[274px] cursor-pointer text-white"
      >
        <div
          className="flex h-[90px] items-center gap-3 py-2 pr-3"
          onClick={handleDownload}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/excel-xls.png" alt="" className="ml-2 h-12 w-12 shrink-0" />
          <div className="leading-tight">
            <p className="text-[14px] opacity-90">
              {new Date(date).toLocaleDateString("en-US")}
            </p>
            <p className="text-[16px] font-bold">ORDERS</p>
            <p className="text-[12px] opacity-90">Download</p>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}
