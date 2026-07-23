import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

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
  null,
];

const SCHED_STATUSES = ["NORMAL", "WILL CALL", "HOLD DELIVERY", "RUSH"];
const CANCEL_STATUSES = ["MOVED TO NEW DATE", "CANCELLED", "WEATHER DELAY"];
const TIME_BUCKETS = ["<24", "24-48", "48-72", ">72"];

function generateMockData(
  customerId: string,
  startDate: string,
  endDate: string
) {
  // Parse customer index from customerId
  const customerIdx = parseInt(customerId.replace("customer-", "")) || 0;
  const customerName = CUSTOMER_NAMES[customerIdx % CUSTOMER_NAMES.length];
  const customerNumber = `CSC${10000 + customerIdx}`;
  const region = REGIONS[customerIdx % REGIONS.length];

  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Generate orders for this customer
  const numOrders = 5 + Math.floor(Math.random() * 15);
  let completedOrders = 0;
  let cancelledOrders = 0;
  let completedVolume = 0;
  let cancelledVolume = 0;

  interface CancelledOrder {
    orderId: string;
    orderNumber: string;
    schedStatus: string;
    scheduledTime: string;
    cancelStatus: string;
    cancelledTime: string;
    timeBucket: string;
    volume: number;
    project: string | null;
    projectNumber: string | null;
  }

  const cancelledOrdersList: CancelledOrder[] = [];
  const exceptionOrders: CancelledOrder[] = [];

  interface DailyData {
    date: string;
    total: number;
    completed: number;
    cancelled: number;
    totalVolume: number;
    completedVolume: number;
    cancelledVolume: number;
  }

  const dailyDataMap: Record<string, DailyData> = {};
  const areaOrdersCompleted: [number, number][] = [];
  const areaOrdersCancelled: [number, number][] = [];
  const areaVolumeCompleted: [number, number][] = [];
  const areaVolumeCancelled: [number, number][] = [];

  for (let i = 0; i < numOrders; i++) {
    const isCompleted = Math.random() > 0.4;
    const volume = 5 + Math.floor(Math.random() * 50);
    const randomDays = Math.floor(Math.random() * (daysDiff + 1));
    const orderDate = new Date(start);
    orderDate.setDate(orderDate.getDate() + randomDays);
    const dateKey = orderDate.toISOString().split("T")[0];

    if (!dailyDataMap[dateKey]) {
      dailyDataMap[dateKey] = {
        date: dateKey,
        total: 0,
        completed: 0,
        cancelled: 0,
        totalVolume: 0,
        completedVolume: 0,
        cancelledVolume: 0,
      };
    }

    dailyDataMap[dateKey].total++;
    dailyDataMap[dateKey].totalVolume += volume;

    if (isCompleted) {
      completedOrders++;
      completedVolume += volume;
      dailyDataMap[dateKey].completed++;
      dailyDataMap[dateKey].completedVolume += volume;
    } else {
      cancelledOrders++;
      cancelledVolume += volume;
      dailyDataMap[dateKey].cancelled++;
      dailyDataMap[dateKey].cancelledVolume += volume;

      const schedStatusIdx = Math.floor(Math.random() * SCHED_STATUSES.length);
      const cancelStatusIdx = Math.floor(Math.random() * CANCEL_STATUSES.length);
      const timeBucketIdx = Math.floor(Math.random() * TIME_BUCKETS.length);
      const projectIdx = Math.floor(Math.random() * PROJECTS.length);

      const scheduledHour = 6 + Math.floor(Math.random() * 10);
      const scheduledTime = new Date(orderDate);
      scheduledTime.setHours(scheduledHour, Math.floor(Math.random() * 60), 0, 0);

      const cancelledTime = new Date(orderDate);
      cancelledTime.setDate(cancelledTime.getDate() - (1 + Math.floor(Math.random() * 3)));
      cancelledTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60), 0, 0);

      const order: CancelledOrder = {
        orderId: `order-${280000 + i}`,
        orderNumber: `${280000 + i + Math.floor(Math.random() * 1000)}`,
        schedStatus: SCHED_STATUSES[schedStatusIdx],
        scheduledTime: scheduledTime.toISOString(),
        cancelStatus: CANCEL_STATUSES[cancelStatusIdx],
        cancelledTime: cancelledTime.toISOString(),
        timeBucket: TIME_BUCKETS[timeBucketIdx],
        volume,
        project: PROJECTS[projectIdx],
        projectNumber: PROJECTS[projectIdx] ? `${10000 + Math.floor(Math.random() * 1000)}` : null,
      };

      cancelledOrdersList.push(order);

      // Randomly add some to exception table
      if (Math.random() > 0.8) {
        exceptionOrders.push(order);
      }
    }
  }

  // Build daily orders array and area chart data
  const dailyOrders = Object.values(dailyDataMap)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => {
      const dateFormatted = new Date(d.date).toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      });
      const timestamp = new Date(d.date).getTime();

      areaOrdersCompleted.push([timestamp, d.completed]);
      areaOrdersCancelled.push([timestamp, d.cancelled]);
      areaVolumeCompleted.push([timestamp, d.completedVolume]);
      areaVolumeCancelled.push([timestamp, d.cancelledVolume]);

      return {
        date: dateFormatted,
        total: d.total,
        completed: d.completed,
        completedPct: d.total > 0 ? Math.round((d.completed / d.total) * 100) : 0,
        cancelled: d.cancelled,
        cancelledPct: d.total > 0 ? Math.round((d.cancelled / d.total) * 100) : 0,
        totalVolume: d.totalVolume,
        completedVolume: d.completedVolume,
        completedVolumePct: d.totalVolume > 0 ? Math.round((d.completedVolume / d.totalVolume) * 100) : 0,
        cancelledVolume: d.cancelledVolume,
        cancelledVolumePct: d.totalVolume > 0 ? Math.round((d.cancelledVolume / d.totalVolume) * 100) : 0,
      };
    });

  const totalOrders = completedOrders + cancelledOrders;
  const totalVolume = completedVolume + cancelledVolume;

  const stats = {
    totalOrders,
    totalVolume,
    completedOrders,
    completedVolume,
    cancelledOrders,
    cancelledVolume,
    completedPct: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
    completedVolumePct: totalVolume > 0 ? Math.round((completedVolume / totalVolume) * 100) : 0,
    cancelledPct: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
    cancelledVolumePct: totalVolume > 0 ? Math.round((cancelledVolume / totalVolume) * 100) : 0,
  };

  const pieDataOrders = [
    { name: "Completed Order", y: completedOrders, sliced: false },
    { name: "Cancelled Order", y: cancelledOrders, sliced: false },
  ];

  const pieDataVolume = [
    { name: "Total Completed Volume", y: completedVolume, sliced: false },
    { name: "Total Cancelled Volume", y: cancelledVolume, sliced: false },
  ];

  const areaDataOrders = {
    completed: areaOrdersCompleted,
    cancelled: areaOrdersCancelled,
  };

  const areaDataVolume = {
    completed: areaVolumeCompleted,
    cancelled: areaVolumeCancelled,
  };

  return {
    customerId,
    customerName,
    customerNumber,
    region,
    stats,
    pieDataOrders,
    pieDataVolume,
    areaDataOrders,
    areaDataVolume,
    dailyOrders,
    cancelledOrders: cancelledOrdersList,
    exceptionOrders,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || "customer-0";
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

    const data = generateMockData(customerId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching customer orders:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer orders data" },
      { status: 500 }
    );
  }
}
