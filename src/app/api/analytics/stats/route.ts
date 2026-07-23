import { NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

export async function GET() {
  try {
    const tenant = await getSelectedTenant();

    // Mock data - in production this would query the database
    // Concrete Supply specific stats
    if (tenant?.toLowerCase().includes("concrete")) {
      return NextResponse.json({
        success: true,
        data: {
          totalUsers: 847,
          totalContractors: 623,
          totalProducers: 224,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: 1250,
        totalContractors: 890,
        totalProducers: 360,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics stats:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
