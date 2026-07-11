export const dynamic = "force-dynamic";

/**
 * GET /api/settings - Retrieve user settings
 */
export async function GET() {
  const settings = {
    mobile: "(310)555-5555",
    tenantswitch: "dolese",
    datetimeformat: "250e1309-5f88-e311-9438-22000a98ac24",
    measurementtypeid: "045C88A1-FF84-E211-8776-9BD4F74E3C8C",
    timezoneid: "e7152892-49ba-4a2a-bb8e-90210848e64b",
    marketsummaryid: "COMPANY",
    notifications: [],
    tileOptions: [],
  };

  return Response.json(settings, {
    headers: { "cache-control": "no-store" },
  });
}

/**
 * POST /api/settings - Save user settings
 */
export async function POST(request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let body;

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.text();
      const params = new URLSearchParams(formData);
      body = Object.fromEntries(params.entries());
    } else {
      body = await request.json();
    }

    console.log("Saving settings:", body);

    // TODO: Save settings to database

    return Response.json({ success: true, message: "Settings saved successfully" });
  } catch (error) {
    console.error("Error saving settings:", error);
    return Response.json(
      { error: "Failed to save settings" },
      { status: 500 }
    );
  }
}
