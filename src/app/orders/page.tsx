import { getDoleseOrders, getDoleseSummary } from "@/actions/orderActions";
import { SubHeader, FoldCard, Dropdown } from "@/components/d3-ui";
import { DateSelect } from "@/components/date-select";
import { OrdersList } from "@/components/orders-list";

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
      <SubHeader title="Dolese Orders" backHref={`/?date=${dateStr}`} />

      <DateSelect value={dateStr} />

      <Dropdown value="dolese">
        <option value="dolese">DOLESE ({fmt(summary.totalCY)} CY)</option>
      </Dropdown>
      <Dropdown value="default">
        <option value="default">Default</option>
      </Dropdown>

      {/* Download tile */}
      <div className="flex">
        <FoldCard tone="green" className="mb-[5px] mr-[5px] w-[274px] text-white">
          <div className="flex h-[90px] items-center gap-3 py-2 pr-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/excel-xls.png" alt="" className="ml-2 h-12 w-12 shrink-0" />
            <div>
              <p className="text-[11px] opacity-90">
                {new Date(dateStr).toLocaleDateString("en-US")}
              </p>
              <p className="text-sm font-bold">ORDERS</p>
              <p className="text-[11px] opacity-90">Download</p>
            </div>
          </div>
        </FoldCard>
      </div>

      <OrdersList orders={orders} />
    </div>
  );
}
