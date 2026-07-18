import { NextResponse } from "next/server";
import { getRolloutCustomer } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/rollout/customers/[customerId]
 * Get rollout customer details with users
 */
export async function GET(request, { params }) {
  try {
    const { customerId } = await params;

    if (!customerId) {
      return NextResponse.json(
        { error: "Customer ID is required" },
        { status: 400 }
      );
    }

    const data = await getRolloutCustomer(Number(customerId));

    if (!data) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Return in the format expected by the HTML page
    return NextResponse.json({
      id: data.id,
      name: data.name,
      code: data.code,
      users: data.users || []
    });
  } catch (error) {
    console.error("Error in GET /api/rollout/customers/[customerId]:", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
