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

      <div className="flex flex-wrap">
        <IconTile
          left={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/contractor.png" alt="" className="h-12 w-auto" />
          }
          tone="blue"
          lines={[
            { text: "EASY", size: 11, dim: true },
            { text: "CUSTOMER", bold: true },
            { text: "INVITE", size: 11, dim: true },
          ]}
        />
        <IconTile
          left={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/fill-form.png" alt="" className="h-11 w-auto" />
          }
          tone="blue"
          lines={[
            { text: "Click Here", size: 11, dim: true },
            { text: "ORDER CONCRETE", bold: true },
            { text: "Its Easy", size: 11, dim: true },
          ]}
        />
      </div>

      <input
        id="tiles-search"
        type="text"
        placeholder="Search"
        className="mb-[10px] h-[30px] w-[274px] rounded-[4px] border border-[#cccccc] bg-white px-[6px] py-[4px] text-sm text-[#555] outline-none transition placeholder:text-[#999] focus:border-[#66afe9] focus:shadow-[0_0_8px_rgba(102,175,233,0.6)]"
      />

      <div className="flex flex-wrap">
        {/* Fuel surcharge */}
        <FoldCard tone="red" className="mb-[5px] mr-[5px] w-[274px] text-white">
          <div className="flex h-[90px] items-center gap-3 py-2 pr-3">
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
    </div>
  );
}
