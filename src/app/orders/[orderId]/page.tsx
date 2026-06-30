import { notFound } from "next/navigation";
import { Cloud } from "lucide-react";
import { getDoleseOrderDetail, type OrderStatus } from "@/actions/orderActions";
import { SubHeader, StatTile, FoldCard } from "@/components/d3-ui";
import { PourChart, TrucksChart } from "@/components/pour-chart";
import { OrderActivity } from "@/components/order-activity";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETED",
  CANCELED: "CANCELLED",
};

/** "9:47 AM" -> { value: "9:47", sub: "AM" } so the big number fits the 88px tile. */
function splitTime(s: string | null): { value: string; sub?: string } {
  if (!s) return { value: "—" };
  const m = s.match(/^(.*?)\s*(AM|PM)$/i);
  return m ? { value: m[1].trim(), sub: m[2].toUpperCase() } : { value: s };
}

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

      <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">
        {STATUS_LABEL[detail.status]} — {detail.customer_name || "—"}
      </h2>

      {/* Spacer below the status line (matches the live app); PDF icon sits at the right. */}
      <div className="relative h-28">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icons/pdf-icon.png"
          alt="PDF"
          className="absolute right-0 top-1/2 h-9 w-9 -translate-y-1/2 cursor-pointer"
        />
      </div>

      {/* Stat tiles */}
      <div className="flex max-w-[279px] flex-wrap">
        <StatTile label="Next Truck" {...splitTime(detail.next_truck)} />
        <StatTile label="Pour Finish" {...splitTime(detail.pour_finish)} />
        <StatTile label="Loads" value={String(detail.loads)} sub={`${detail.trucks} trucks`} />
        <StatTile label="Ordered" value={detail.ordered_cy.toFixed(2)} sub="CY" />
        <StatTile label="Ticketed" value={detail.ticketed_cy.toFixed(2)} sub="CY" />
        <StatTile label="On Job" value={detail.on_job_cy.toFixed(2)} sub="CY" />
      </div>

      {/* Weather */}
      {detail.weather && (
        <FoldCard tone="blue" className="h-[90px] w-[274px] text-white">
          <div className="flex h-[90px] items-center gap-3 px-3">
            {detail.weather.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`https://d3.truckast.com/IMAGES/ICONS/${detail.weather.icon.toUpperCase()}.PNG`}
                alt=""
                className="h-12 w-12 shrink-0"
              />
            ) : (
              <Cloud className="h-12 w-12 shrink-0" strokeWidth={1.6} />
            )}
            <div className="min-w-0 leading-tight">
              {detail.weather.place ? (
                <p className="text-[11px] opacity-90">{detail.weather.place} Plant</p>
              ) : null}
              <p className="text-sm font-bold">
                {detail.weather.temp} {detail.weather.description}
              </p>
              {detail.weather.humidity || detail.weather.pressure || detail.weather.wind ? (
                <p className="text-[11px] opacity-90">
                  {[
                    detail.weather.humidity ? `H: ${detail.weather.humidity}` : null,
                    detail.weather.pressure ? `P: ${detail.weather.pressure}` : null,
                    detail.weather.wind ? `W: ${detail.weather.wind} S` : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              ) : null}
              {detail.weather.updated ? (
                <p className="text-[11px] opacity-90">Last Update: {detail.weather.updated}</p>
              ) : null}
            </div>
          </div>
        </FoldCard>
      )}

      {/* Pour speed + trucks-on-the-job charts */}
      <PourChart data={detail.charts} />
      <TrucksChart data={detail.charts} />

      {/* Message / activity feed */}
      <OrderActivity
        messages={detail.activity}
        summary={
          <>
            <p>Order Number: {detail.order_code}</p>
            <p>Order Status: {STATUS_LABEL[detail.status]}</p>
            {detail.plant_code ? <p>Plant: {detail.plant_code}</p> : null}
            <p>Ordered: {detail.ordered_cy.toFixed(2)} CY</p>
            <p>Ticketed: {detail.ticketed_cy.toFixed(2)} CY</p>
          </>
        }
      />
    </div>
  );
}
