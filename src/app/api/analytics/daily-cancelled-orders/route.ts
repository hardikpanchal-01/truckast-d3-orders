import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

// Mock data for daily cancelled orders
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
  timeBucket: string; // <24, 24-48, 48-72, >72
}

interface Stats {
  totalOrders: number;
  totalVolume: number;
  lt24Orders: number;
  lt24Volume: number;
  orders24_48: number;
  volume24_48: number;
  orders48_72: number;
  volume48_72: number;
  gt72Orders: number;
  gt72Volume: number;
}

// Sample customer names for mock data
const CUSTOMER_NAMES = [
  "LITHKO CONTRACTING INC",
  "PRECISION CONCRETE CONST INC",
  "CAROLINA CURB AND GUTTER, LLC",
  "BLYTHE DEVELOPMENT CO",
  "JRG CONCRETE OF SC INC",
  "DOGGETT CONCRETE CONSTRUCTION",
  "BAKER CONCRETE CONSTRUCTION",
  "WAYNE BROTHERS, INC",
  "ELDRIDGE CONCRETE CONST INC",
  "M O FLOWE CONSTRUCTION INC",
  "CONCRETE CONSTRUCTION SOLUTIONS, LLC",
  "PEDULLA EXCAVATING & PAVING INC",
  "AVIATOR PAVING COMPANY",
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
  "CLT - VARIOUS",
  "CLT - SCDOT HWY 72",
  "CLT - DLR MAIN BLDG SOG",
  "RAL - DOWNTOWN OFFICE COMPLEX",
  "COL - SHOPPING CENTER EXPANSION",
  null,
];

const SCHED_STATUSES = ["NORMAL", "WILL CALL", "HOLD DELIVERY", "RUSH"];
const CANCEL_STATUSES = ["MOVED TO NEW DATE", "CANCELLED", "WEATHER DELAY"];
const TIME_BUCKETS = ["<24", "24-48", "48-72", ">72"];

function generateMockData(region: string, date: string) {
  const baseDate = new Date(date);

  // Generate cancelled orders
  const cancelledOrders: CancelledOrder[] = [];
  const numOrders = 80 + Math.floor(Math.random() * 120);

  // Stats counters
  let lt24Orders = 0,
    lt24Volume = 0;
  let orders24_48 = 0,
    volume24_48 = 0;
  let orders48_72 = 0,
    volume48_72 = 0;
  let gt72Orders = 0,
    gt72Volume = 0;

  for (let i = 0; i < numOrders; i++) {
    const customerIdx = Math.floor(Math.random() * CUSTOMER_NAMES.length);
    const regionIdx = Math.floor(Math.random() * REGIONS.length);
    const projectIdx = Math.floor(Math.random() * PROJECTS.length);
    const schedStatusIdx = Math.floor(Math.random() * SCHED_STATUSES.length);
    const cancelStatusIdx = Math.floor(Math.random() * CANCEL_STATUSES.length);

    // Weight towards <24 hours (about 70%)
    let timeBucketIdx;
    const rand = Math.random();
    if (rand < 0.7) {
      timeBucketIdx = 0; // <24
    } else if (rand < 0.85) {
      timeBucketIdx = 1; // 24-48
    } else if (rand < 0.93) {
      timeBucketIdx = 2; // 48-72
    } else {
      timeBucketIdx = 3; // >72
    }

    const timeBucket = TIME_BUCKETS[timeBucketIdx];

    const scheduledHour = 3 + Math.floor(Math.random() * 14);
    const scheduledTime = new Date(baseDate);
    scheduledTime.setHours(scheduledHour, Math.floor(Math.random() * 60), 0, 0);

    // Calculate cancelled time based on time bucket
    const cancelledTime = new Date(baseDate);
    let daysBack = 0;
    if (timeBucket === "<24") {
      daysBack = Math.random() > 0.5 ? 0 : 1;
    } else if (timeBucket === "24-48") {
      daysBack = 1;
    } else if (timeBucket === "48-72") {
      daysBack = 2;
    } else {
      daysBack = 3 + Math.floor(Math.random() * 8);
    }
    cancelledTime.setDate(cancelledTime.getDate() - daysBack);
    cancelledTime.setHours(
      Math.floor(Math.random() * 24),
      Math.floor(Math.random() * 60),
      0,
      0
    );

    const selectedRegion = REGIONS[regionIdx];

    // Filter by region if specified
    if (region !== "ALL" && selectedRegion !== region.replace(/_/g, " ")) {
      continue;
    }

    const volume = 5 + Math.floor(Math.random() * 150);

    // Update stats
    if (timeBucket === "<24") {
      lt24Orders++;
      lt24Volume += volume;
    } else if (timeBucket === "24-48") {
      orders24_48++;
      volume24_48 += volume;
    } else if (timeBucket === "48-72") {
      orders48_72++;
      volume48_72 += volume;
    } else {
      gt72Orders++;
      gt72Volume += volume;
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
      volume,
      project: PROJECTS[projectIdx],
      projectNumber: PROJECTS[projectIdx]
        ? `${10000 + customerIdx}${100 + Math.floor(Math.random() * 50)}`
        : null,
      region: selectedRegion,
      timeBucket,
    });
  }

  const totalOrders = cancelledOrders.length;
  const totalVolume = cancelledOrders.reduce(
    (sum, order) => sum + order.volume,
    0
  );

  // Calculate percentages for pie charts
  const pieDataOrders = [
    {
      name: "<24",
      y: totalOrders > 0 ? (lt24Orders / totalOrders) * 100 : 0,
      sliced: false,
    },
    {
      name: "24-48",
      y: totalOrders > 0 ? (orders24_48 / totalOrders) * 100 : 0,
      sliced: false,
    },
    {
      name: "48-72",
      y: totalOrders > 0 ? (orders48_72 / totalOrders) * 100 : 0,
      sliced: false,
    },
    {
      name: ">72",
      y: totalOrders > 0 ? (gt72Orders / totalOrders) * 100 : 0,
      sliced: false,
    },
  ];

  const pieDataVolume = [
    {
      name: "<24",
      y: totalVolume > 0 ? (lt24Volume / totalVolume) * 100 : 0,
      sliced: false,
    },
    {
      name: "24-48",
      y: totalVolume > 0 ? (volume24_48 / totalVolume) * 100 : 0,
      sliced: false,
    },
    {
      name: "48-72",
      y: totalVolume > 0 ? (volume48_72 / totalVolume) * 100 : 0,
      sliced: false,
    },
    {
      name: ">72",
      y: totalVolume > 0 ? (gt72Volume / totalVolume) * 100 : 0,
      sliced: false,
    },
  ];

  const regionName =
    region === "ALL" ? "CONCRETE SUPPLY" : region.replace(/_/g, " ");

  const stats: Stats = {
    totalOrders,
    totalVolume,
    lt24Orders,
    lt24Volume,
    orders24_48,
    volume24_48,
    orders48_72,
    volume48_72,
    gt72Orders,
    gt72Volume,
  };

  return {
    stats,
    pieDataOrders,
    pieDataVolume,
    regionName,
    cancelledOrders,
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
    console.error("Error fetching daily cancelled orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch daily cancelled orders data" },
      { status: 500 }
    );
  }
}
