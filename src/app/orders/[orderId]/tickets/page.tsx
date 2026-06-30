import { notFound } from "next/navigation";
import { getDoleseTicketSummary, type OrderStatus } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";
import { TicketSummaryList } from "@/components/ticket-summary";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<OrderStatus, string> = {
  IN_PROCESS: "IN PROCESS",
  PRE_POUR: "PRE-POUR",
  COMPLETED: "COMPLETE",
  CANCELED: "CANCELLED",
};

export default async function TicketSummaryPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const summary = await getDoleseTicketSummary(Number(orderId));
  if (!summary) notFound();

  return (
    <div className="space-y-5">
      <SubHeader
        title={`Order ${summary.order_code}`}
        subtitle={summary.subtitle || undefined}
        backHref={`/orders/${summary.order_id}`}
      />

      <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-800">
        {STATUS_LABEL[summary.status]} - {summary.customer_name || "—"}
      </h2>

      <TicketSummaryList loads={summary.loads} orderId={summary.order_id} />
    </div>
  );
}
