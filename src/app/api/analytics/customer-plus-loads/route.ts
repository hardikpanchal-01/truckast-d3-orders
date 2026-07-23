import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

const CUSTOMER_NAMES = [
  "ACE / AVANT CONCRETE CONSTR",
  "ARTISTIC FLOOR",
  "CASH SALES RAL",
  "CENTURY CONCRETE OF THE CAROLINAS, LLC",
  "CF SOLAR, LLC",
  "CONCRETE CONSTRUCTION SOLUTIONS, LLC",
  "JC BUILDING, INC",
  "JRG CONCRETE OF SC INC",
  "ROBINS & MORTON",
  "SITEWORKS LLC (CHARLOTTE)",
  "LITHKO CONTRACTING INC",
  "DR HORTON",
  "BRASFIELD & GORRIE, LLC",
  "WAYNE BROTHERS, INC",
  "KENT COMPANIES INC",
];

const MARKETS = [
  "CHARLOTTE",
  "RALEIGH",
  "COLUMBIA",
  "COASTAL",
  "CHARLESTON",
  "UPSTATE",
  "SANDHILLS",
  "CENTRAL CAROLINA",
  "American Concrete & Precast",
  "TRI-CITY CONCRETE",
];

interface CustomerPlusLoad {
  orderDate: string;
  customer: string;
  customerNumber: string;
  orderNumber: string;
  orderId: string;
  plusLoads: number;
  market: string;
}

function generateMockData(
  customerId: string,
  region: string,
  startDate: string,
  endDate: string,
  includePlusLoad: boolean
): { customerName: string; customerNumber: string; plusLoads: CustomerPlusLoad[] } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Get customer index from customerId
  const customerIdx = parseInt(customerId.replace("customer-", "")) || 0;
  const customerName = CUSTOMER_NAMES[customerIdx % CUSTOMER_NAMES.length];
  const customerNumber = `CSC${10001 + customerIdx}`;

  const plusLoads: CustomerPlusLoad[] = [];
  const numRecords = Math.max(5, Math.min(20, daysDiff * 2 + Math.floor(Math.random() * 5)));

  for (let i = 0; i < numRecords; i++) {
    const marketIdx = Math.floor(Math.random() * MARKETS.length);
    const selectedMarket = MARKETS[marketIdx];

    // Filter by region
    if (region !== "ALL" && selectedMarket !== region.replace(/_/g, " ")) {
      continue;
    }

    // Random date within range
    const randomDays = Math.floor(Math.random() * (daysDiff + 1));
    const orderDate = new Date(start);
    orderDate.setDate(orderDate.getDate() + randomDays);

    const dateStr = orderDate.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "2-digit",
    });

    const orderNum = 230000 + Math.floor(Math.random() * 10000);

    // Plus loads count (1-5, with bias toward lower numbers)
    let plusLoadCount = Math.ceil(Math.random() * 3);
    if (!includePlusLoad) {
      plusLoadCount = Math.max(1, plusLoadCount - 1);
    }

    plusLoads.push({
      orderDate: dateStr,
      customer: customerName,
      customerNumber: customerNumber,
      orderNumber: orderNum.toString(),
      orderId: `order-${orderNum}`,
      plusLoads: plusLoadCount,
      market: selectedMarket,
    });
  }

  // Sort by order date descending
  plusLoads.sort((a, b) => {
    const dateA = new Date(a.orderDate);
    const dateB = new Date(b.orderDate);
    return dateB.getTime() - dateA.getTime();
  });

  return {
    customerName,
    customerNumber,
    plusLoads,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || "customer-0";
    const region = searchParams.get("region") || "ALL";
    const includePlusLoad = searchParams.get("includePlusLoad") === "true";

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate =
      searchParams.get("startDate") || weekAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(customerId, region, startDate, endDate, includePlusLoad);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching customer plus loads data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer plus loads data" },
      { status: 500 }
    );
  }
}
