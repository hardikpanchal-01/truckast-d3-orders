import { notFound } from "next/navigation";
import { getDoleseTicketDetail, type TicketEventCard, type TicketProductCard } from "@/actions/orderActions";
import { SubHeader, FoldCard } from "@/components/d3-ui";
import { TicketIcon } from "@/components/ticket-icons";

export const dynamic = "force-dynamic";

/** Shared 274×90 tile body: 72×82 icon slot + stacked text lines. */
function TileBody({
  slug,
  badge,
  title,
  value,
  sub,
}: {
  slug: string;
  badge?: string;
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex h-full items-center gap-2 p-1">
      <div className="flex h-[82px] w-[72px] shrink-0 items-center justify-center">
        <TicketIcon slug={slug} badge={badge} />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[14px] opacity-95">{title}</p>
        <p className="text-[16px] font-bold leading-tight">{value}</p>
        {sub ? <p className="truncate text-[12px] opacity-90">{sub}</p> : null}
      </div>
    </div>
  );
}

function ProductCard({ p }: { p: TicketProductCard }) {
  return (
    <FoldCard tone={p.is_mix ? "green" : "blue"} noFold className="h-[90px] w-[274px] text-white">
      <TileBody
        slug="order"
        badge="ORDER"
        title={`${p.item_code}${p.description ? ` (${p.description})` : ""}`}
        value={`${p.qty.toFixed(2)} ${p.unit}`}
        sub={p.slump != null ? `SLUMP: ${p.slump} IN` : undefined}
      />
    </FoldCard>
  );
}

function EventCard({ ev }: { ev: TicketEventCard }) {
  return (
    <FoldCard tone={ev.dark ? "gray" : "blue"} noFold className="h-[90px] w-[274px] text-white">
      <TileBody
        slug={ev.dark ? "verifi" : ev.icon}
        badge={ev.dark ? undefined : ev.badge}
        title={ev.title}
        value={ev.value}
        sub={ev.sub}
      />
    </FoldCard>
  );
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ orderId: string; ticketId: string }>;
}) {
  const { orderId, ticketId } = await params;
  const detail = await getDoleseTicketDetail(Number(ticketId));
  if (!detail) notFound();

  return (
    <div className="space-y-5">
      <SubHeader
        title={`Ticket ${detail.ticket_code}`}
        subtitle={detail.subtitle || undefined}
        backHref={`/orders/${orderId}/tickets`}
      />

      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">{detail.status}</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/pdf-icon.png" alt="PDF" className="h-12 w-12 cursor-pointer" />
      </div>

      {/* Plant / truck header card */}
      <FoldCard tone="blue" noFold className="h-[90px] w-[274px] text-white">
        <TileBody
          slug="truck"
          title={detail.plant_name ? `PLANT: ${detail.plant_name}` : ""}
          value={`TRUCK: ${detail.truck_code ?? "—"}`}
          sub={detail.printed_stamp || undefined}
        />
      </FoldCard>

      {/* Ordered products */}
      {detail.products.length > 0 && (
        <div className="flex flex-wrap gap-[10px]">
          {detail.products.map((p, i) => (
            <ProductCard key={i} p={p} />
          ))}
        </div>
      )}

      {/* Status timeline + Verifi readings */}
      {detail.events.length > 0 && (
        <div className="flex flex-wrap gap-[10px]">
          {detail.events.map((ev, i) => (
            <EventCard key={i} ev={ev} />
          ))}
        </div>
      )}
    </div>
  );
}
