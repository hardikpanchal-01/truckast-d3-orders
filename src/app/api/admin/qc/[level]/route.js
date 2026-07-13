export const dynamic = "force-dynamic";

import { createClient } from "@supabase/supabase-js";

/**
 * API endpoint for getting a specific evaporation message by level.
 */

// Default evaporation messages
const DEFAULT_MESSAGES = {
  high: { level: "high", tagline: "Tagline", title: "High Risk", subtitle: "Subtitle", color: "#2f7ed8", message: "" },
  moderate: { level: "moderate", tagline: "Tagline", title: "Moderate Risk", subtitle: "Subtitle", color: "#2f7ed8", message: "" },
  low: { level: "low", tagline: "Tagline", title: "Low Risk", subtitle: "Subtitle", color: "#2f7ed8", message: "" },
};

export async function GET(request, { params }) {
  try {
    const { level } = await params;

    if (!level || !["high", "moderate", "low"].includes(level)) {
      return Response.json(
        { success: false, error: "Invalid evaporation level" },
        { status: 400, headers: { "cache-control": "no-store" } }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return Response.json(
        { success: false, error: "Server configuration error" },
        { status: 500, headers: { "cache-control": "no-store" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Try to get the evaporation message from database
    const { data, error } = await supabase
      .from("evaporation_messages")
      .select("*")
      .eq("level", level)
      .single();

    if (error) {
      console.log("[QC] Could not fetch evaporation message for", level, ":", error.message);
      // Return default if not found
      return Response.json(
        { success: true, data: DEFAULT_MESSAGES[level] },
        { headers: { "cache-control": "no-store" } }
      );
    }

    return Response.json(
      { success: true, data },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (error) {
    console.error("[ERROR] /api/admin/qc/[level]:", error);
    return Response.json(
      { success: false, error: "Failed to get evaporation message" },
      { status: 500, headers: { "cache-control": "no-store" } }
    );
  }
}
