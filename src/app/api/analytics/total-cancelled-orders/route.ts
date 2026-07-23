import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

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
  timeBucket: string;
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

function generateMockData(
  region: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  const cancelledOrders: CancelledOrder[] = [];
  // Generate more orders for longer date ranges
  const numOrders = Math.max(100, daysDiff * 30 + Math.floor(Math.random() * 50));

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

    // Weight towards <24 hours (~68%)
    let timeBucketIdx;
    const rand = Math.random();
    if (rand < 0.68) {
      timeBucketIdx = 0; // <24
    } else if (rand < 0.83) {
      timeBucketIdx = 1; // 24-48
    } else if (rand < 0.89) {
      timeBucketIdx = 2; // 48-72
    } else {
      timeBucketIdx = 3; // >72
    }

    const timeBucket = TIME_BUCKETS[timeBucketIdx];

    // Random date within range
    const randomDays = Math.floor(Math.random() * (daysDiff + 1));
    const orderDate = new Date(start);
    orderDate.setDate(orderDate.getDate() + randomDays);

    const scheduledHour = 3 + Math.floor(Math.random() * 14);
    const scheduledTime = new Date(orderDate);
    scheduledTime.setHours(scheduledHour, Math.floor(Math.random() * 60), 0, 0);

    const cancelledTime = new Date(orderDate);
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

    if (region !== "ALL" && selectedRegion !== region.replace(/_/g, " ")) {
      continue;
    }

    const volume = 5 + Math.floor(Math.random() * 150);

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

  // Calculate top 10 by count and volume
  const customerStats: Record<
    string,
    {
      customerName: string;
      lt24Count: number;
      count24_48: number;
      count48_72: number;
      gt72Count: number;
      totalCount: number;
      lt24Volume: number;
      volume24_48: number;
      volume48_72: number;
      gt72Volume: number;
      totalVolume: number;
    }
  > = {};

  cancelledOrders.forEach((order) => {
    if (!customerStats[order.customerName]) {
      customerStats[order.customerName] = {
        customerName: order.customerName,
        lt24Count: 0,
        count24_48: 0,
        count48_72: 0,
        gt72Count: 0,
        totalCount: 0,
        lt24Volume: 0,
        volume24_48: 0,
        volume48_72: 0,
        gt72Volume: 0,
        totalVolume: 0,
      };
    }

    const cs = customerStats[order.customerName];
    cs.totalCount++;
    cs.totalVolume += order.volume;

    if (order.timeBucket === "<24") {
      cs.lt24Count++;
      cs.lt24Volume += order.volume;
    } else if (order.timeBucket === "24-48") {
      cs.count24_48++;
      cs.volume24_48 += order.volume;
    } else if (order.timeBucket === "48-72") {
      cs.count48_72++;
      cs.volume48_72 += order.volume;
    } else {
      cs.gt72Count++;
      cs.gt72Volume += order.volume;
    }
  });

  const customerList = Object.values(customerStats);

  // Top 10 by count
  const top10ByCountList = [...customerList]
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 10);

  const top10ByCount = {
    categories: top10ByCountList.map((c) => c.customerName),
    lt24: top10ByCountList.map((c) => c.lt24Count),
    orders24_48: top10ByCountList.map((c) => c.count24_48),
    orders48_72: top10ByCountList.map((c) => c.count48_72),
    gt72: top10ByCountList.map((c) => c.gt72Count),
  };

  // Top 10 by volume
  const top10ByVolumeList = [...customerList]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10);

  const top10ByVolume = {
    categories: top10ByVolumeList.map((c) => c.customerName),
    lt24: top10ByVolumeList.map((c) => c.lt24Volume),
    volume24_48: top10ByVolumeList.map((c) => c.volume24_48),
    volume48_72: top10ByVolumeList.map((c) => c.volume48_72),
    gt72: top10ByVolumeList.map((c) => c.gt72Volume),
  };

  // Company totals for the table - include region info
  const companyTotalsMap: Record<
    string,
    {
      customerId: string;
      customerName: string;
      customerNumber: string;
      region: string;
      lt24Count: number;
      count24_48: number;
      count48_72: number;
      gt72Count: number;
      totalCount: number;
      lt24Volume: number;
      volume24_48: number;
      volume48_72: number;
      gt72Volume: number;
      totalVolume: number;
    }
  > = {};

  cancelledOrders.forEach((order) => {
    const key = `${order.customerName}-${order.region}`;
    if (!companyTotalsMap[key]) {
      companyTotalsMap[key] = {
        customerId: order.customerId,
        customerName: order.customerName,
        customerNumber: order.customerNumber,
        region: order.region,
        lt24Count: 0,
        count24_48: 0,
        count48_72: 0,
        gt72Count: 0,
        totalCount: 0,
        lt24Volume: 0,
        volume24_48: 0,
        volume48_72: 0,
        gt72Volume: 0,
        totalVolume: 0,
      };
    }

    const ct = companyTotalsMap[key];
    ct.totalCount++;
    ct.totalVolume += order.volume;

    if (order.timeBucket === "<24") {
      ct.lt24Count++;
      ct.lt24Volume += order.volume;
    } else if (order.timeBucket === "24-48") {
      ct.count24_48++;
      ct.volume24_48 += order.volume;
    } else if (order.timeBucket === "48-72") {
      ct.count48_72++;
      ct.volume48_72 += order.volume;
    } else {
      ct.gt72Count++;
      ct.gt72Volume += order.volume;
    }
  });

  const companyTotals = Object.values(companyTotalsMap).sort(
    (a, b) => a.customerName.localeCompare(b.customerName)
  );

  return {
    stats,
    pieDataOrders,
    pieDataVolume,
    regionName,
    cancelledOrders,
    top10ByCount,
    top10ByVolume,
    companyTotals,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "ALL";
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startDate =
      searchParams.get("startDate") || firstOfMonth.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || yesterday.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(region, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching total cancelled orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch total cancelled orders data" },
      { status: 500 }
    );
  }
}
