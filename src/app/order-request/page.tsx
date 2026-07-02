import { SubHeader, FoldCard, SearchBox, Dropdown } from "@/components/d3-ui";
import { getOrderRequests, type OrderRequestItem } from "@/actions/orderActions";
import { OrderRequestList } from "@/components/order-request-list";

export const dynamic = "force-dynamic";

export default async function OrderRequestPage() {
  const orders = await getOrderRequests();

  return (
    <div className="space-y-5">
      <SubHeader title="ORDER REQUEST DASHBOARD" backHref="/" />

      <Dropdown value="all">
        <option value="all">ALL REGIONS</option>
      </Dropdown>

      <OrderRequestList orders={orders} />
    </div>
  );
}
