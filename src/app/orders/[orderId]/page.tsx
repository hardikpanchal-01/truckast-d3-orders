import { notFound } from "next/navigation";
import { Cloud, FileText } from "lucide-react";
import { getDoleseOrderDetail, type OrderStatus } from "@/actions/orderActions";
import { SubHeader, StatTile, FoldCard } from "@/components/d3-ui";
import { PourChart } from "@/components/pour-chart";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { orderId } = await params;
  const { date } = await searchParams;
  const detail = await getDoleseOrderDetail(Number(orderId));
  if (!detail) notFound();

  const backHref = date ? `/orders?date=${date}` : "/orders";

  return (
    <div className="space-y-5">
      <SubHeader
        title={`Order ${detail.order_code}`}
        subtitle={detail.delivery_addr1 || detail.project_name || undefined}
        backHref={backHref}
      />

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">
          {STATUS_LABEL[detail.status]} — {detail.customer_name || "—"}
        </h2>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#cf3a2c] text-white">
          <FileText className="h-4 w-4" />
        </span>
      </div>

      {/* Stat tiles */}
      <div className="grid max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
        <StatTile label="Next Truck" value={detail.next_truck || "—"} />
        <StatTile label="Pour Finish" value={detail.pour_finish || "—"} />
        <StatTile label="Loads" value={String(detail.loads)} sub={`${detail.trucks} trucks`} />
        <StatTile label="Ordered" value={detail.ordered_cy.toFixed(2)} sub="CY" />
        <StatTile label="Ticketed" value={detail.ticketed_cy.toFixed(2)} sub="CY" />
        <StatTile label="On Job" value={detail.on_job_cy.toFixed(2)} sub="CY" />
      </div>

      {/* Weather */}
      {detail.weather && (
        <FoldCard tone="blue" className="max-w-2xl text-white">
          <div className="flex items-center gap-3 px-3 py-3">
            <Cloud className="h-9 w-9" strokeWidth={1.6} />
            <div>
              {detail.weather.place ? (
                <p className="text-[11px] opacity-90">{detail.weather.place} Plant</p>
              ) : null}
              <p className="text-sm font-bold">
                {detail.weather.temp} {detail.weather.description}
              </p>
            </div>
          </div>
        </FoldCard>
      )}

      {/* Pour speed chart */}
      <PourChart series={detail.pour_series} />
    </div>
  );
}
