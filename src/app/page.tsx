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

  // getDoleseSummary now returns data from tenant-specific database
  // and includes the correct tenant name
  const summary = await getDoleseSummary(dateStr, dateToStr);

  // Desktop (≥980) gets a roomier vertical rhythm (space-y-6 = 24px) between the
  // stacked rows; below that it stays compact at space-y-4 (16px). The old inline
  // marginTop overrides were removed so this responsive spacing actually applies.
  return (
    <div className="space-y-4 min-[980px]:space-y-6">
      <SubHeader title={`${summary.name.split(" ")[0].charAt(0).toUpperCase() + summary.name.split(" ")[0].slice(1).toLowerCase()} Orders`} />

      <DateSelect value={dateStr} valueTo={dateToStr} />

      <div className="flex flex-wrap">
        <IconTile
          href="/rollout/search"
          left={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/contractor.png" alt="" style={{ width: 72, height: 82, marginRight: 8, marginBottom: 5, marginLeft: 5 }} />
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
            <img src="/icons/fill-form.png" alt="" style={{ width: 64, height: 64, marginRight: 8, marginBottom: 5, marginLeft: 5 }} />
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
