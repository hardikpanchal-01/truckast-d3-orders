import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const TENANT_COOKIE = "selected_tenant";

/**
 * GET /api/settings/tenant - Get current selected tenant
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const selectedTenant = cookieStore.get(TENANT_COOKIE)?.value || null;

    return Response.json({
      success: true,
      tenant: selectedTenant,
    });
  } catch (error) {
    console.error("Error getting selected tenant:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/tenant - Set selected tenant
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const tenantName = body.tenant;

    if (!tenantName) {
      return Response.json(
        { success: false, error: "Tenant name is required" },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(TENANT_COOKIE, tenantName, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: "/",
    });

    return Response.json({
      success: true,
      message: "Tenant selected successfully",
      tenant: tenantName,
    });
  } catch (error) {
    console.error("Error setting tenant:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
