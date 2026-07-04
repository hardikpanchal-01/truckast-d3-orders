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
        className="mb-[5px] w-full cursor-pointer text-white sm:mr-[5px] sm:w-[279px]"
      >
        {/* D3 .tileContainer: 5px padding; icon in a 72×80 box (mr 5) with the badge
            centered; info section 185×80 with the text vertically centered. */}
        <div className="flex h-[90px] items-center p-[5px]" onClick={handleDownload}>
          <div className="flex h-[80px] w-[72px] shrink-0 items-start justify-start self-start" style={{ marginRight: "5px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/excel-xls.png" alt="Export to Excel" className="h-[64px] w-[64px]" />
          </div>
          <div className="flex h-[80px] min-w-0 flex-1 flex-col justify-center overflow-hidden leading-[1.4] [&>p]:m-0">
            <p className="truncate text-[14px]">{shown}</p>
            <p className="truncate text-[16px] font-bold">ORDERS</p>
            <p className="truncate text-[12px]" style={{ lineHeight: "1.4" }}>
              Download
            </p>
          </div>
        </div>
      </FoldCard>
    </div>
  );
}
