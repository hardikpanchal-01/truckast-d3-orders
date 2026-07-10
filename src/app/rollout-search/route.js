import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "rollout-search.html");
const ASSET = "/d3-static/JobsForFixedNodeID_files";

/**
 * Rollout Search page — returns the exact D3 "Search" HTML document
 * directly as the /rollout-search response.
 */
export async function GET() {
  try {
    let html = await readFile(TEMPLATE_PATH, "utf8");

    // Absolutize the relative asset paths so CSS/JS/images resolve correctly
    html = html.split("./JobsForFixedNodeID_files/").join(ASSET + "/");

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error reading rollout-search.html:", error);
    return new Response("Error: " + error.message, { status: 500 });
  }
}
