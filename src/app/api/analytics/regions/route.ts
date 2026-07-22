import { NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

export async function GET() {
  try {
    const tenant = await getSelectedTenant();

    // Mock data - in production this would query the database
    if (tenant?.toLowerCase().includes("concrete")) {
      return NextResponse.json({
        success: true,
        data: [
          { name: "AMARILLO", producerCount: 12, contractorCount: 45 },
          { name: "AUSTIN", producerCount: 28, contractorCount: 89 },
          { name: "DALLAS", producerCount: 35, contractorCount: 124 },
          { name: "EL PASO", producerCount: 8, contractorCount: 32 },
          { name: "FORT WORTH", producerCount: 22, contractorCount: 78 },
          { name: "HOUSTON", producerCount: 48, contractorCount: 156 },
          { name: "LUBBOCK", producerCount: 10, contractorCount: 28 },
          { name: "SAN ANTONIO", producerCount: 31, contractorCount: 95 },
        ],
      });
    }

    return NextResponse.json({
      success: true,
      data: [
        { name: "REGION 1", producerCount: 45, contractorCount: 120 },
        { name: "REGION 2", producerCount: 38, contractorCount: 98 },
        { name: "REGION 3", producerCount: 52, contractorCount: 145 },
      ],
    });
  } catch (error) {
    console.error("Error fetching analytics regions:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch regions" },
      { status: 500 }
    );
  }
}
