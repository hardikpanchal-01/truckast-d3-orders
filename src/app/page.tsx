import { getDoleseSummary } from "@/actions/orderActions";
import { SubHeader, IconTile } from "@/components/d3-ui";
import { DateSelect } from "@/components/date-select";
import { MarketTiles } from "@/components/market-tiles";

export const dynamic = "force-dynamic";

export default async function MarketSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; dateTo?: string }>;
}) {
  const { date, dateTo } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = date || today;
  const dateToStr = dateTo || undefined;

const summary = await getDoleseSummary(dateStr, dateToStr);

  return (
    <div className="space-y-4">
      <SubHeader title="Dolese Orders" />

      <DateSelect value={dateStr} valueTo={dateToStr} />

      <div className="flex flex-wrap">
        <IconTile
          href="/rollout/search"
          left={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/contractor.png" alt="" className="h-12 w-auto" />
          }
          tone="blue"
          lines={[
            { text: "EASY", size: 14, dim: true },
            { text: "CUSTOMER", bold: true, size: 16 },
            { text: "INVITE", size: 12, dim: true },
          ]}
        />
        <IconTile
          href="/order-request/project"
          left={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/fill-form.png" alt="" className="h-11 w-auto" />
          }
          tone="blue"
          lines={[
            { text: "Click Here", size: 14, dim: true },
            { text: "ORDER CONCRETE", bold: true, size: 16 },
            { text: "Its Easy", size: 12, dim: true },
          ]}
        />
      </div>

      <MarketTiles summary={summary} dateStr={dateStr} />
    </div>
  );
}
