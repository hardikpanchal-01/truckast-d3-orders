import { Users, ClipboardList } from "lucide-react";
import { getDoleseSummary } from "@/actions/orderActions";
import { SubHeader, IconTile, FoldCard, PieGauge } from "@/components/d3-ui";
import { DateSelect } from "@/components/date-select";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function MarketSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = date || today;

  const summary = await getDoleseSummary(dateStr);
  const pct = summary.totalCY > 0 ? summary.usedCY / summary.totalCY : 0;

  return (
    <div className="space-y-4">
      <SubHeader title="Dolese Orders" />

      <DateSelect value={dateStr} />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <IconTile
          left={<Users className="h-10 w-10" strokeWidth={1.6} />}
          tone="blue"
          lines={[
            { text: "EASY", size: 11, dim: true },
            { text: "CUSTOMER", bold: true },
            { text: "INVITE", size: 11, dim: true },
          ]}
        />
        <IconTile
          left={<ClipboardList className="h-10 w-10" strokeWidth={1.6} />}
          tone="blue"
          lines={[
            { text: "Click Here", size: 11, dim: true },
            { text: "ORDER CONCRETE", bold: true },
            { text: "Its Easy", size: 11, dim: true },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {/* Fuel surcharge */}
        <FoldCard tone="red" className="text-white">
          <div className="flex min-h-[84px] items-center gap-3 py-2 pr-3">
            <div className="ml-2 grid h-12 w-12 shrink-0 place-items-center rounded bg-white text-[10px] font-black italic text-[#0a5a2a]">
              DOLESE
            </div>
            <div className="min-w-0">
              <p className="text-[11px] opacity-90">June 22nd thru 26th, 2026</p>
              <p className="text-sm font-bold">Current Fuel Surcharge</p>
              <p className="text-[11px] opacity-90">$30.00 per load *Click for Details</p>
            </div>
          </div>
        </FoldCard>

        {/* Business-unit total -> drill into orders */}
        <IconTile
          tone="green"
          href={`/orders?date=${dateStr}`}
          left={<PieGauge pct={pct} size={52} />}
          lines={[
            { text: summary.name, bold: true },
            { text: `${fmt(summary.usedCY)} OF ${fmt(summary.totalCY)} CY`, size: 12 },
            {
              text: `Tot ${summary.totalOrders}, Act ${summary.activeOrders}, Can ${summary.cancelledOrders}`,
              size: 11,
              dim: true,
            },
          ]}
        />
      </div>

      <p className="text-center text-xs text-slate-400">
        Click the green <strong>DOLESE</strong> tile to see the day&apos;s orders.
      </p>
    </div>
  );
}
