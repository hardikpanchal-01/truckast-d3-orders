import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

// Mock data for same day cancelled orders
// In production, this would query the database

interface CancelledOrder {
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerNumber: string;
  schedStatus: string;
  scheduledTime: string;
  cancelStatus: string;
  cancelledTime: string;
  volume: number;
  project: string | null;
  projectNumber: string | null;
  region: string;
  isException?: boolean;
}

interface CompanyTotal {
  customerId: string;
  customerName: string;
  customerNumber: string;
  total: number;
  totalCY: number;
  region: string;
}

interface TopCustomer {
  customerName: string;
  count?: number;
  volume?: number;
}

// Sample customer names for mock data
const CUSTOMER_NAMES = [
  "LITHKO CONTRACTING INC",
  "AVIATOR PAVING COMPANY",
  "BENTON CONCRETE & UTILITIES LLC",
  "BAKER CONCRETE CONSTRUCTION",
  "BLYTHE DEVELOPMENT CO",
  "PRECISION CONCRETE CONST INC",
  "DOGGETT CONCRETE CONSTRUCTION",
  "PEDULLA EXCAVATING & PAVING INC",
  "WAYNE BROTHERS, INC",
  "ELDRIDGE CONCRETE CONST INC",
  "M O FLOWE CONSTRUCTION INC",
  "CONCRETE CONSTRUCTION SOLUTIONS, LLC",
  "CONCRETE SUPPLY CO - INT",
  "HIDALGOS MASONRY, INC",
  "BOBBYS CONCRETE INC",
  "RINNOVARE, INC",
  "GOSALIA CONCRETE CONSTRUCTION, INC",
  "JRG CONCRETE OF SC INC",
  "BROOKS-BERRY-HAYNIE & ASSOC INC",
  "ALL AMERICAN CONCRETE (NC)",
];

const REGIONS = [
  "CHARLOTTE",
  "RALEIGH",
  "COLUMBIA",
  "COASTAL",
  "CHARLESTON",
  "UPSTATE",
  "SANDHILLS",
  "CENTRAL CAROLINA",
  "CAROLINA READY MIX",
  "TRI-CITY CONCRETE",
];

const PROJECTS = [
  "CLT - QTS DATA CENTER 2",
  "CLT - QTS DATA CENTER 3",
  "CLT - 526 S. CHURCH ST.",
  "CLT - PANORAMA FALCON",
  "CLT - TRAILHEAD TOWNHOMES",
  "CLT - CHARLOTTE MAIN LIBRARY",
  "RAL - DOWNTOWN OFFICE COMPLEX",
  "COL - SHOPPING CENTER EXPANSION",
  "CST - MB Various",
  null,
];

const SCHED_STATUSES = ["NORMAL", "WILL CALL", "RUSH"];
const CANCEL_STATUSES = ["MOVED TO NEW DATE", "CANCELLED", "WEATHER DELAY"];

function generateMockData(region: string, date: string) {
  const baseDate = new Date(date);
  const prevDay = new Date(baseDate);
  prevDay.setDate(prevDay.getDate() - 1);

  // Generate cancelled orders
  const cancelledOrders: CancelledOrder[] = [];
  const numOrders = 50 + Math.floor(Math.random() * 50);

  for (let i = 0; i < numOrders; i++) {
    const customerIdx = Math.floor(Math.random() * CUSTOMER_NAMES.length);
    const regionIdx = Math.floor(Math.random() * REGIONS.length);
    const projectIdx = Math.floor(Math.random() * PROJECTS.length);
    const schedStatusIdx = Math.floor(Math.random() * SCHED_STATUSES.length);
    const cancelStatusIdx = Math.floor(Math.random() * CANCEL_STATUSES.length);

    const scheduledHour = 4 + Math.floor(Math.random() * 12);
    const cancelledHour = Math.floor(Math.random() * 24);

    const scheduledTime = new Date(baseDate);
    scheduledTime.setHours(scheduledHour, Math.floor(Math.random() * 60), 0, 0);

    const cancelledTime = new Date(
      Math.random() > 0.3 ? baseDate : prevDay
    );
    cancelledTime.setHours(cancelledHour, Math.floor(Math.random() * 60), 0, 0);

    const selectedRegion = REGIONS[regionIdx];

    // Filter by region if specified
    if (region !== "ALL" && selectedRegion !== region.replace(/_/g, " ")) {
      continue;
    }

    cancelledOrders.push({
      orderId: `order-${100000 + i}`,
      orderNumber: `${100000 + i + Math.floor(Math.random() * 10000)}`,
      customerId: `customer-${customerIdx}`,
      customerName: CUSTOMER_NAMES[customerIdx],
      customerNumber: `CSC${10000 + customerIdx}`,
      schedStatus: SCHED_STATUSES[schedStatusIdx],
      scheduledTime: scheduledTime.toISOString(),
      cancelStatus: CANCEL_STATUSES[cancelStatusIdx],
      cancelledTime: cancelledTime.toISOString(),
      volume: 5 + Math.floor(Math.random() * 120),
      project: PROJECTS[projectIdx],
      projectNumber: PROJECTS[projectIdx]
        ? `${10000 + customerIdx}${100 + Math.floor(Math.random() * 50)}`
        : null,
      region: selectedRegion,
      isException: Math.random() < 0.05, // 5% are exceptions
    });
  }

  // Calculate stats
  const totalOrders = cancelledOrders.length;
  const totalVolume = cancelledOrders.reduce(
    (sum, order) => sum + order.volume,
    0
  );

  // Calculate company totals
  const companyMap = new Map<
    string,
    { total: number; totalCY: number; region: string; customerNumber: string }
  >();

  cancelledOrders.forEach((order) => {
    const key = order.customerName;
    const existing = companyMap.get(key);
    if (existing) {
      existing.total += 1;
      existing.totalCY += order.volume;
    } else {
      companyMap.set(key, {
        total: 1,
        totalCY: order.volume,
        region: order.region,
        customerNumber: order.customerNumber,
      });
    }
  });

  const companyTotals: CompanyTotal[] = Array.from(companyMap.entries())
    .map(([customerName, data], idx) => ({
      customerId: `customer-${idx}`,
      customerName,
      customerNumber: data.customerNumber,
      total: data.total,
      totalCY: data.totalCY,
      region: data.region,
    }))
    .sort((a, b) => b.total - a.total);

  // Top 10 by count
  const top10ByCount: TopCustomer[] = companyTotals.slice(0, 10).map((c) => ({
    customerName: c.customerName,
    count: c.total,
  }));

  // Top 10 by volume
  const top10ByVolume: TopCustomer[] = [...companyTotals]
    .sort((a, b) => b.totalCY - a.totalCY)
    .slice(0, 10)
    .map((c) => ({
      customerName: c.customerName,
      volume: c.totalCY,
    }));

  // Separate exception orders
  const exceptionOrders = cancelledOrders.filter((o) => o.isException);
  const regularOrders = cancelledOrders.filter((o) => !o.isException);

  return {
    totalOrders,
    totalVolume,
    top10ByCount,
    top10ByVolume,
    companyTotals,
    cancelledOrders: regularOrders,
    exceptionOrders,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "ALL";
    const date =
      searchParams.get("date") || new Date().toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    // Generate mock data
    const data = generateMockData(region, date);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching same day cancellations:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch same day cancellations data" },
      { status: 500 }
    );
  }
}
