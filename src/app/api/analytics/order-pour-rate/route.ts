import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

const CUSTOMER_NAMES = [
  "LITHKO CONTRACTING INC",
  "CASH SALES TRI CITY",
  "4 YARDS OR LESS",
  "CASH SALES CAE",
  "O&D CONCRETE COMPANY, INC",
  "CASH SALES RAL",
  "CAROLINA CURB AND GUTTER, LLC",
  "DR HORTON",
  "CASH SALES RAY A",
  "DOGGETT CONCRETE CONST",
  "FESSLER & BOWMAN INC",
  "KENT COMPANIES INC",
  "CONCRETE CONSTRUCTION SOLUTIONS, LLC",
  "WAYNE BROTHERS, INC",
  "BRASFIELD & GORRIE, LLC",
  "OLYMPIC CONSTRUCTION, LLC",
  "ARCO DESIGN BUILD, INC.",
  "WALBRIDGE ALDINGER, LLC",
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

interface Order {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  orderedVolume: number;
  pouredVolume: number;
  actualJobDuration: string;
  scheduledPourRate: number;
  actualPourRate: number;
  pourRatePct: number;
  tileColor: string;
  customerId: string;
  customerName: string;
  customerNumber: string;
  region: string;
}

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

  const orders: Order[] = [];
  const numOrders = Math.max(80, daysDiff * 30 + Math.floor(Math.random() * 50));

  // Scatter data - x is timestamp, y is pour rate %
  const scatterGreen: [number, number][] = [];
  const scatterYellow: [number, number][] = [];
  const scatterRed: [number, number][] = [];

  // For bar chart data - by customer name
  const customerOrdersGreen: Record<string, number> = {};
  const customerOrdersYellow: Record<string, number> = {};
  const customerOrdersRed: Record<string, number> = {};
  const customerVolumeGreen: Record<string, number> = {};
  const customerVolumeYellow: Record<string, number> = {};
  const customerVolumeRed: Record<string, number> = {};

  // Pie chart data
  let greenOrders = 0, yellowOrders = 0, redOrders = 0;
  let greenVolume = 0, yellowVolume = 0, redVolume = 0;

  for (let i = 0; i < numOrders; i++) {
    const customerIdx = Math.floor(Math.random() * CUSTOMER_NAMES.length);
    const regionIdx = Math.floor(Math.random() * REGIONS.length);
    const selectedRegion = REGIONS[regionIdx];

    // Filter by region
    if (region !== "ALL" && selectedRegion !== region.replace(/_/g, " ")) {
      continue;
    }

    const customerName = CUSTOMER_NAMES[customerIdx];

    // Random date within range
    const randomDays = Math.floor(Math.random() * (daysDiff + 1));
    const orderDate = new Date(start);
    orderDate.setDate(orderDate.getDate() + randomDays);
    orderDate.setHours(Math.floor(Math.random() * 12) + 6, Math.floor(Math.random() * 60), 0, 0);

    const timestamp = orderDate.getTime();
    const dateKey = orderDate.toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });

    // Initialize customer stats if needed
    if (!customerOrdersGreen[customerName]) {
      customerOrdersGreen[customerName] = 0;
      customerOrdersYellow[customerName] = 0;
      customerOrdersRed[customerName] = 0;
      customerVolumeGreen[customerName] = 0;
      customerVolumeYellow[customerName] = 0;
      customerVolumeRed[customerName] = 0;
    }

    const orderedVolume = 2 + Math.floor(Math.random() * 80);
    const pouredVolume = Math.floor(orderedVolume * (0.8 + Math.random() * 0.2));
    const scheduledPourRate = 5 + Math.floor(Math.random() * 50);
    const actualPourRate = Math.floor(scheduledPourRate * (0.2 + Math.random() * 1.2));
    const pourRatePct = scheduledPourRate > 0 ? Math.round((actualPourRate / scheduledPourRate) * 100) : 0;

    // D3 uses: >= 90% (green), 60-89% (black/yellow), < 60% (red)
    let tileColor: string;
    if (pourRatePct >= 90) {
      tileColor = "Green";
      greenOrders++;
      greenVolume += pouredVolume;
      scatterGreen.push([timestamp, pourRatePct]);
      customerOrdersGreen[customerName]++;
      customerVolumeGreen[customerName] += pouredVolume;
    } else if (pourRatePct >= 60) {
      tileColor = "Yellow";
      yellowOrders++;
      yellowVolume += pouredVolume;
      scatterYellow.push([timestamp, pourRatePct]);
      customerOrdersYellow[customerName]++;
      customerVolumeYellow[customerName] += pouredVolume;
    } else {
      tileColor = "Red";
      redOrders++;
      redVolume += pouredVolume;
      scatterRed.push([timestamp, pourRatePct]);
      customerOrdersRed[customerName]++;
      customerVolumeRed[customerName] += pouredVolume;
    }

    const durationMinutes = Math.floor(Math.random() * 60);
    const actualJobDuration = `00:${durationMinutes.toString().padStart(2, "0")}`;

    orders.push({
      orderId: `order-${100000 + i}`,
      orderNumber: `${100000 + i + Math.floor(Math.random() * 50000)}`,
      orderDate: dateKey,
      orderedVolume,
      pouredVolume,
      actualJobDuration,
      scheduledPourRate,
      actualPourRate,
      pourRatePct,
      tileColor,
      customerId: `customer-${customerIdx}`,
      customerName,
      customerNumber: `CSC${10000 + customerIdx}`,
      region: selectedRegion,
    });
  }

  // Get top 10 customers by total orders for bar charts
  const customerTotals = Object.keys(customerOrdersGreen).map(name => ({
    name,
    total: customerOrdersGreen[name] + customerOrdersYellow[name] + customerOrdersRed[name],
    totalVolume: customerVolumeGreen[name] + customerVolumeYellow[name] + customerVolumeRed[name],
  }));

  // Sort by total orders for first chart
  const top10ByOrders = [...customerTotals]
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  // Sort by total volume for second chart
  const top10ByVolume = [...customerTotals]
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10);

  const scatterData = {
    green: scatterGreen,
    yellow: scatterYellow,
    red: scatterRed,
  };

  const totalOrders = greenOrders + yellowOrders + redOrders;
  const totalVolume = greenVolume + yellowVolume + redVolume;

  const pieDataOrders = [
    { name: ">= 90% of scheduled pour rate", y: totalOrders > 0 ? (greenOrders / totalOrders) * 100 : 0, color: "#7cb5ec", sliced: false },
    { name: "< 60% scheduled of pour rate", y: totalOrders > 0 ? (redOrders / totalOrders) * 100 : 0, color: "#434348", sliced: false },
    { name: ">=60% - 89% scheduled of pour rate", y: totalOrders > 0 ? (yellowOrders / totalOrders) * 100 : 0, color: "#90ed7d", sliced: false },
  ];

  const pieDataVolume = [
    { name: ">= 90% of scheduled pour rate", y: totalVolume > 0 ? (greenVolume / totalVolume) * 100 : 0, color: "#7cb5ec", sliced: false },
    { name: "< 60% scheduled of pour rate", y: totalVolume > 0 ? (redVolume / totalVolume) * 100 : 0, color: "#434348", sliced: false },
    { name: ">=60% - 89% scheduled of pour rate", y: totalVolume > 0 ? (yellowVolume / totalVolume) * 100 : 0, color: "#90ed7d", sliced: false },
  ];

  const barDataOrders = {
    categories: top10ByOrders.map((c) => c.name),
    green: top10ByOrders.map((c) => customerOrdersGreen[c.name] || 0),
    yellow: top10ByOrders.map((c) => customerOrdersYellow[c.name] || 0),
    red: top10ByOrders.map((c) => customerOrdersRed[c.name] || 0),
  };

  const barDataVolume = {
    categories: top10ByVolume.map((c) => c.name),
    green: top10ByVolume.map((c) => customerVolumeGreen[c.name] || 0),
    yellow: top10ByVolume.map((c) => customerVolumeYellow[c.name] || 0),
    red: top10ByVolume.map((c) => customerVolumeRed[c.name] || 0),
  };

  return {
    scatterData,
    pieDataOrders,
    pieDataVolume,
    barDataOrders,
    barDataVolume,
    orders: orders.slice(0, 100),
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "ALL";
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate =
      searchParams.get("startDate") || weekAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(region, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching order pour rate data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch order pour rate data" },
      { status: 500 }
    );
  }
}
