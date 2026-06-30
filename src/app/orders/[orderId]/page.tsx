import { notFound } from "next/navigation";
import { Cloud } from "lucide-react";
import { getDoleseOrderDetail, type OrderStatus } from "@/actions/orderActions";
import { SubHeader, StatTile, FoldCard, EvapIcon } from "@/components/d3-ui";
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

      {/* Spacer below the status line (matches the live app); XLS + PDF icons at the right. */}
      <div className="relative h-28">
        <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://d3.truckast.com/Images/excel-xls-icon.48x48pixel.png"
            alt="Export to Excel"
            className="h-12 w-12 cursor-pointer"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/pdf-icon.png"
            alt="PDF"
            className="h-12 w-12 cursor-pointer"
          />
        </div>
      </div>

      {/* Stat tiles — status-aware, color-coded to match the live D3 app.
          PRE-POUR shows scheduling info (next truck, ordered CY …);
          in-process / completed orders show pour results (poured, on-time, delays). */}
      <div className="flex max-w-[279px] flex-wrap">
        {detail.status === "PRE_POUR" || detail.status === "CANCELED" ? (
          <>
            <StatTile label="Next Truck" {...splitTime(detail.next_truck)} tone="blue" />
            <StatTile label="Pour Finish" {...splitTime(detail.pour_finish)} tone="blue" />
            <StatTile
              label="Loads"
              value={String(detail.loads)}
              sub={`${detail.trucks} trucks`}
              tone="blue"
              href={`/orders/${detail.order_id}/tickets`}
            />
            <StatTile label="Ordered" value={detail.ordered_cy.toFixed(2)} sub="CY" tone="blue" />
            <StatTile label="Ticketed" value={detail.ticketed_cy.toFixed(2)} sub="CY" tone="green" />
            <StatTile label="On Job" value={detail.on_job_cy.toFixed(2)} sub="CY" tone="blue" />
          </>
        ) : (
          <>
            <StatTile
              label="Loads"
              value={String(detail.loads)}
              tone="blue"
              href={`/orders/${detail.order_id}/tickets`}
            />
            <StatTile label="Loads" value={`${detail.on_time_pct} %`} sub="On Time" tone="green" />
            <StatTile label="Poured" value={detail.poured_cy.toFixed(2)} sub="CY" tone="blue" />
            <StatTile label="Pour Rate" value={detail.pour_rate.toFixed(2)} sub="CY/HR" tone="blue" />
            <StatTile label="Dolese" value={String(detail.dolese_delay_min)} sub="Delay Min" tone="green" />
            <StatTile
              label={STATUS_LABEL[detail.status]}
              value={String(detail.job_delay_min)}
              sub="Delay Min"
              tone="red"
              href={`/orders/${detail.order_id}/delays`}
            />
          </>
        )}
      </div>

      {/* Weather */}
      {detail.weather && (
        <FoldCard tone="blue" noFold className="h-[90px] w-[274px] text-white">
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
                    detail.weather.wind
                      ? `W: ${detail.weather.wind}${detail.weather.direction ? ` ${detail.weather.direction}` : ""}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              ) : null}
              {detail.weather.updated ? (
                <p className="text-[11px] opacity-90">Final Update: {detail.weather.updated}</p>
              ) : null}
            </div>
          </div>
        </FoldCard>
      )}

      {/* Evaporation rate (ACI 305 surface-evaporation guide) */}
      {detail.evaporation && (
        <FoldCard tone="green" noFold className="w-[274px] text-white">
          <div className="flex items-center gap-3 px-3 py-2">
            <EvapIcon className="h-12 w-12 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-sm font-bold">Evaporation Rate</p>
              <p className="text-[11px] opacity-90">
                Concrete: {detail.evaporation.concreteTempF}F, {detail.evaporation.rate.toFixed(3)} lb/ft^2/hr
              </p>
              <p className="text-[11px] opacity-90">Shrinkage Cracking: {detail.evaporation.risk}</p>
              <p className="text-[11px] opacity-90">
                Please use as a guide{detail.evaporation.ticketNo ? ` TN:${detail.evaporation.ticketNo}` : ""}
              </p>
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
