import { NextResponse } from "next/server";
import { getTenants } from "@/actions/tenantActions";

export const dynamic = "force-dynamic";

/**
 * GET /api/tenants
 * List all available tenants (for debugging)
 */
export async function GET() {
  try {
    const tenants = await getTenants();
    return NextResponse.json({
      success: true,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        d3_tenant_name: t.d3_tenant_name || t.name // Use d3_tenant_name if available, otherwise fall back to name
      }))
    });
  } catch (error) {
    console.error("Error fetching tenants:", error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
