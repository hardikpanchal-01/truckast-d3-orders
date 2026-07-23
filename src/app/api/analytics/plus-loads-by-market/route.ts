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
  "FESSLER & BOWMAN INC",
  "DOGGETT CONCRETE CONST",
  "O&D CONCRETE COMPANY, INC",
  "CAROLINA CURB AND GUTTER, LLC",
  "OLYMPIC CONSTRUCTION, LLC",
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

const PROJECT_NAMES = [
  "RAL - Floor and Decor",
  "N/A",
  "COD - SANDHILLS CALL IN",
  "UPS-VARIOUS PROJECTS 2026 - DELIVERED",
  "Bear Branch",
  "COL-oLiv Columbia",
  "CLT - UNCC RICHARDSON STADIUM EXPANSION",
  "ACP Westbriar Woods",
  "CLT - ATRIUM CABARRUS EXPANSION",
  "CLT - SUTHERLAND PHASE 1",
  "RAL - Amazon Distribution Center",
  "CHR - Magnolia Park Phase 2",
  "UPS - Greenville Tech Campus",
];

interface PlusLoad {
  orderDate: string;
  customer: string;
  customerNumber: string;
  customerId: string;
  orderNumber: string;
  orderId: string;
  projectName: string;
  projectNumber: string;
  plusLoads: number;
  market: string;
}

function generateMockData(
  region: string,
  startDate: string,
  endDate: string,
  includePlusLoad: boolean
): PlusLoad[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const plusLoads: PlusLoad[] = [];
  const numRecords = Math.max(50, daysDiff * 15 + Math.floor(Math.random() * 30));

  for (let i = 0; i < numRecords; i++) {
    const customerIdx = Math.floor(Math.random() * CUSTOMER_NAMES.length);
    const marketIdx = Math.floor(Math.random() * MARKETS.length);
    const projectIdx = Math.floor(Math.random() * PROJECT_NAMES.length);
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

    const customerNumber = `CSC${10000 + Math.floor(Math.random() * 90000)}`;
    const orderNum = 100000 + Math.floor(Math.random() * 900000);
    const projectNum = `${orderDate.getFullYear()}-${3000 + Math.floor(Math.random() * 1000)}`;

    // Plus loads count (1-5, with bias toward lower numbers)
    let plusLoadCount = Math.ceil(Math.random() * 3);
    if (!includePlusLoad) {
      plusLoadCount = Math.max(1, plusLoadCount - 1);
    }

    plusLoads.push({
      orderDate: dateStr,
      customer: CUSTOMER_NAMES[customerIdx],
      customerNumber: customerNumber,
      customerId: `customer-${customerIdx}`,
      orderNumber: orderNum.toString(),
      orderId: `order-${orderNum}`,
      projectName: PROJECT_NAMES[projectIdx],
      projectNumber: projectNum,
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

  return plusLoads;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
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

    const data = generateMockData(region, startDate, endDate, includePlusLoad);

    return NextResponse.json({
      success: true,
      data: {
        plusLoads: data,
        total: data.length,
      },
    });
  } catch (error) {
    console.error("Error fetching plus loads by market data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch plus loads by market data" },
      { status: 500 }
    );
  }
}
