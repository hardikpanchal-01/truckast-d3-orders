import { NextResponse } from "next/server";
import { searchRolloutCustomers } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/rollout/customers?q=searchterm
 * Search rollout customers by name or code
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";

    if (!q.trim()) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    const customers = await searchRolloutCustomers(q);

    return NextResponse.json({
      success: true,
      data: customers
    });
  } catch (error) {
    console.error("Error in GET /api/rollout/customers:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
