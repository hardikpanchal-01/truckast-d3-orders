import { getDoleseOrders, getDoleseSummary } from "@/actions/orderActions";
import { SubHeader, Dropdown } from "@/components/d3-ui";
import { DateSelect } from "@/components/date-select";
import { OrdersList } from "@/components/orders-list";
import { DownloadTile } from "@/components/download-tile";

export const dynamic = "force-dynamic";

function fmt(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = date || today;

  const [orders, summary] = await Promise.all([getDoleseOrders(dateStr), getDoleseSummary(dateStr)]);

  return (
    <div className="space-y-4">
      <SubHeader title={`${summary.name} Orders`} backHref={`/?date=${dateStr}`} />

      <DateSelect value={dateStr} />

      <Dropdown value={summary.name.toLowerCase()}>
        <option value={summary.name.toLowerCase()}>{summary.name.toUpperCase()} ({fmt(summary.totalCY)} CY)</option>
      </Dropdown>
      <Dropdown value="default">
        <option value="default">Default</option>
      </Dropdown>

      {/* Download tile */}
      <DownloadTile date={dateStr} />

      <OrdersList orders={orders} />
    </div>
  );
}
