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
  "SOUTHERN READY MIX",
  "TRI-CITY CONCRETE",
];

interface ContractorUser {
  userName: string;
  contractor: string;
  invitedBy: string;
  invitedDate: string;
  lastAccessDate: string;
  lastOrderDate: string;
}

interface ExceptionOrder {
  orderNumber: string;
  customerName: string;
  customerNumber: string;
  orderDate: string;
  volume: number;
  status: string;
  businessUnit: string;
}

function generateMockData(customerId: string, startDate: string, endDate: string) {
  // Get customer index from customerId
  const customerIdx = parseInt(customerId.replace("customer-", "")) || 0;
  const customerName = CUSTOMER_NAMES[customerIdx % CUSTOMER_NAMES.length];
  const accountNumber = (20000 + customerIdx).toString();
  const region = REGIONS[customerIdx % REGIONS.length];

  // Generate random statistics
  const totalOrders = 3 + Math.floor(Math.random() * 10);
  const completedOrders = Math.floor(totalOrders * 0.7);
  const cancelledOrders = Math.floor(totalOrders * 0.2);
  const exceptionOrders = totalOrders - completedOrders - cancelledOrders;

  const totalVolume = 30 + Math.random() * 100;
  const completedVolume = totalVolume * 0.6;
  const cancelledVolume = totalVolume * 0.35;
  const exceptionVolume = totalVolume - completedVolume - cancelledVolume;

  const stats = {
    totalCompletedOrders: completedOrders,
    totalCompletedVolume: completedVolume,
    totalCancelledOrders: cancelledOrders,
    totalCancelledVolume: cancelledVolume,
    totalExceptionOrders: exceptionOrders,
    totalExceptionVolume: exceptionVolume,
    pctCompletedOrders: totalOrders > 0 ? (completedOrders / totalOrders) * 100 : 0,
    pctCompletedVolume: totalVolume > 0 ? (completedVolume / totalVolume) * 100 : 0,
    pctCancelledOrders: totalOrders > 0 ? (cancelledOrders / totalOrders) * 100 : 0,
    pctCancelledVolume: totalVolume > 0 ? (cancelledVolume / totalVolume) * 100 : 0,
    pctExceptionOrders: totalOrders > 0 ? (exceptionOrders / totalOrders) * 100 : 0,
    pctExceptionVolume: totalVolume > 0 ? (exceptionVolume / totalVolume) * 100 : 0,
  };

  // Generate contractor users (empty for most customers)
  const contractorUsers: ContractorUser[] = [];

  // Generate exception orders
  const exceptionOrdersList: ExceptionOrder[] = [];
  for (let i = 0; i < exceptionOrders; i++) {
    const orderDate = new Date(startDate);
    orderDate.setDate(orderDate.getDate() + Math.floor(Math.random() * 7));

    exceptionOrdersList.push({
      orderNumber: (100000 + Math.floor(Math.random() * 900000)).toString(),
      customerName: customerName,
      customerNumber: accountNumber,
      orderDate: orderDate.toLocaleDateString("en-US", {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
      volume: 5 + Math.random() * 20,
      status: "Exception",
      businessUnit: region,
    });
  }

  return {
    companyName: customerName,
    accountNumber: accountNumber,
    region: region,
    totalUsers: 0,
    stats: stats,
    contractorUsers: contractorUsers,
    exceptionOrders: exceptionOrdersList,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const customerId = searchParams.get("customerId") || "customer-0";

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate =
      searchParams.get("startDate") || weekAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(customerId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching customer dashboard data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch customer dashboard data" },
      { status: 500 }
    );
  }
}
