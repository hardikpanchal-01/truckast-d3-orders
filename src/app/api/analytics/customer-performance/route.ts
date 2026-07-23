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
  "BAKER CONCRETE CONSTRUCTION",
  "CAROLINA CONCRETE FINISHERS",
  "SUMMIT CONSTRUCTION GROUP",
  "PIEDMONT PAVING & CONCRETE",
  "ATLANTIC CONCRETE SERVICES",
  "TAYLOR CONCRETE & MASONRY",
  "BLUE RIDGE BUILDERS",
  "SOUTHERN CONCRETE SOLUTIONS",
  "MIDLANDS CONSTRUCTION CO",
  "COASTAL CONCRETE CONTRACTORS",
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
  "AMERICAN CONCRETE & PRECAST",
  "PORTABLE",
  "CAROLINA READY MIX",
  "TRI-CITY CONCRETE",
  "SOUTHERN READY MIX",
];

interface CustomerPerformance {
  customerName: string;
  customerNumber: string;
  numberOfOrders: number;
  orderConcreteQuantity: number;
  averageOrderSize: number;
  deliveredConcreteQuantity: number;
  concreteLoadCount: number;
  averageLoadSize: number;
  loading: number;
  toJob: number;
  waiting: number;
  pouring: number;
  scheduledSpacing: number;
  wash: number;
  toPlant: number;
  tripTime: number;
  qtyPerHour: number;
}

function generateMockData(
  region: string,
  top: number,
  startDate: string,
  endDate: string
): { customers: CustomerPerformance[] } {
  const customers: CustomerPerformance[] = [];

  // Generate customers based on filter criteria
  const shuffledNames = [...CUSTOMER_NAMES].sort(() => Math.random() - 0.5);
  const selectedNames = shuffledNames.slice(0, Math.min(top, CUSTOMER_NAMES.length));

  selectedNames.forEach((name, idx) => {
    const customerNumber = (20000 + idx).toString();

    // Generate random performance metrics
    const numberOfOrders = 5 + Math.floor(Math.random() * 50);
    const orderConcreteQuantity = 100 + Math.random() * 2000;
    const averageOrderSize = orderConcreteQuantity / numberOfOrders;
    const deliveredConcreteQuantity = orderConcreteQuantity * (0.85 + Math.random() * 0.15);
    const concreteLoadCount = Math.floor(deliveredConcreteQuantity / (8 + Math.random() * 4));
    const averageLoadSize = concreteLoadCount > 0 ? deliveredConcreteQuantity / concreteLoadCount : 0;

    // Time metrics in minutes
    const loading = 5 + Math.random() * 10;
    const toJob = 15 + Math.random() * 30;
    const waiting = Math.random() * 15;
    const pouring = 10 + Math.random() * 20;
    const scheduledSpacing = 10 + Math.random() * 20;
    const wash = 3 + Math.random() * 7;
    const toPlant = 15 + Math.random() * 30;
    const tripTime = loading + toJob + waiting + pouring + wash + toPlant;
    const qtyPerHour = (tripTime > 0) ? (averageLoadSize / (tripTime / 60)) : 0;

    customers.push({
      customerName: name,
      customerNumber,
      numberOfOrders,
      orderConcreteQuantity,
      averageOrderSize,
      deliveredConcreteQuantity,
      concreteLoadCount,
      averageLoadSize,
      loading,
      toJob,
      waiting,
      pouring,
      scheduledSpacing,
      wash,
      toPlant,
      tripTime,
      qtyPerHour,
    });
  });

  // Sort by scheduled spacing (ascending - best performers first)
  customers.sort((a, b) => a.scheduledSpacing - b.scheduledSpacing);

  return { customers };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const region = searchParams.get("region") || "ALL";
    const top = parseInt(searchParams.get("top") || "10");

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate =
      searchParams.get("startDate") || weekAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(region, top, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching customer performance data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer performance data" },
      { status: 500 }
    );
  }
}
