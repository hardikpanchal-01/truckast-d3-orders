import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "announcements.html");
const ASSET = "/d3-static/JobsForFixedNodeID_files";

/**
 * Fuel Surcharges / Announcements page — returns the exact D3 "Announcements" HTML document
 * directly as the /fuel-surcharges response. The shell is the real D3 export with
 * d3_complete.css + assets. The server only absolutizes the asset paths for this route.
 */
export async function GET() {
  let html = await readFile(TEMPLATE_PATH, "utf8");

  // Absolutize the relative asset paths so CSS/JS/images resolve correctly
  html = html.split("./JobsForFixedNodeID_files/").join(ASSET + "/");

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
