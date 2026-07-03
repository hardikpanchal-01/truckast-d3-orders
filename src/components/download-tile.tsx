"use client";

import { FoldCard } from "@/components/d3-ui";

export function DownloadTile({ date }: { date: string }) {
  const handleDownload = () => {
    window.location.href = `/api/orders/export?date=${date}`;
  };

  // Zero-padded MM/DD/YYYY like D3 (avoid new Date() TZ shift; date is YYYY-MM-DD).
  const [yy, mm, dd] = date.split("-");
  const shown = mm && dd && yy ? `${mm}/${dd}/${yy}` : date;

  return (
    <div className="flex">
      <FoldCard
        tone="green"
        className="mb-[5px] w-full cursor-pointer text-white sm:mr-[5px] sm:pb-[1px] sm:w-[274px]"
      >
        <div
          className="flex h-[90px] items-center gap-2 py-2 pr-3"
          onClick={handleDownload}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/excel-xls.png"
            alt="Export to Excel"
            className="h-16 w-16 shrink-0 self-start"
            style={{ margin: "-2px 0px 0 5px" }}
          />
          <div className="leading-tight [&>p]:m-0">
            <p className="text-[14px] opacity-90">{shown}</p>
            <p className="text-[16px] font-bold">ORDERS</p>
            <p className="text-[12px] opacity-90 ">Download</p>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}
