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

const AREAS = [
  "CHARLOTTE",
  "RALEIGH",
  "COLUMBIA",
  "COASTAL",
  "CHARLESTON",
  "UPSTATE",
  "SANDHILLS",
  "CENTRAL CAROLINA",
  "AMERICAN CONCRETE & PRECAST",
  "TRI-CITY CONCRETE",
  "CAROLINA READY MIX",
  "PORTABLE",
];

interface Customer {
  customerId: string;
  customerName: string;
  customerNumber: string;
  area: string;
  orderCount: number;
  volume: number;
}

function generateMockData(
  searchText: string,
  organization: string,
  startDate: string,
  endDate: string
): { customers: Customer[] } {
  const customers: Customer[] = [];

  // Generate customers based on search criteria
  CUSTOMER_NAMES.forEach((name, idx) => {
    // Filter by search text if provided
    if (searchText && searchText.length > 0) {
      const searchLower = searchText.toLowerCase();
      const nameLower = name.toLowerCase();
      const customerNumber = `CSC${10001 + idx}`;

      if (!nameLower.includes(searchLower) && !customerNumber.toLowerCase().includes(searchLower)) {
        return;
      }
    }

    const areaIdx = idx % AREAS.length;
    const area = AREAS[areaIdx];

    // Filter by organization/area if not ALL
    if (organization && organization !== "ALL") {
      const orgNormalized = organization.replace(/_/g, " ");
      if (area !== orgNormalized && !area.includes(orgNormalized)) {
        return;
      }
    }

    const orderCount = 2 + Math.floor(Math.random() * 10);
    const volume = 10 + Math.random() * 100;

    customers.push({
      customerId: `customer-${idx}`,
      customerName: name,
      customerNumber: `${20000 + idx}`,
      area: area,
      orderCount: orderCount,
      volume: volume,
    });
  });

  // Sort by customer name
  customers.sort((a, b) => a.customerName.localeCompare(b.customerName));

  return { customers };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const searchText = searchParams.get("searchText") || "";
    const organization = searchParams.get("organization") || "ALL";

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const startDate =
      searchParams.get("startDate") || weekAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(searchText, organization, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error searching customers:", error);
    return NextResponse.json(
      { success: false, error: "Failed to search customers" },
      { status: 500 }
    );
  }
}
