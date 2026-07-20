import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "rollout-user-details.html");
const ASSET_PATH = "/d3-static/JobsForFixedNodeID_files";

/**
 * Rollout User Details page — shows user info and action tiles.
 */
export async function GET() {
  try {
    let html = await readFile(TEMPLATE_PATH, "utf8");

    // Fix relative asset paths to absolute paths
    html = html.split("./JobsForFixedNodeID_files/").join(ASSET_PATH + "/");

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error reading rollout-user-details.html:", error);
    return new Response("Error: " + error.message, { status: 500 });
  }
}
