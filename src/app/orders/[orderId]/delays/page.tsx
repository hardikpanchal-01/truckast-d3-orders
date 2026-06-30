import { notFound } from "next/navigation";
import { getDoleseCustomerDelay } from "@/actions/orderActions";
import { SubHeader } from "@/components/d3-ui";
import { CustomerDelayList } from "@/components/customer-delay";

export const dynamic = "force-dynamic";

export default async function CustomerDelayPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const data = await getDoleseCustomerDelay(Number(orderId));
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <SubHeader
        title={`${data.customer_name || "—"} - DELAY MINUTES`}
        heightClass="h-[76px]"
        subtitle={
          <>
            {data.order_line ? <p>{data.order_line}</p> : null}
            {data.address_line ? <p>{data.address_line}</p> : null}
          </>
        }
        backHref={`/orders/${orderId}`}
      />
      <CustomerDelayList loads={data.loads} orderId={data.order_id} />
    </div>
  );
}
