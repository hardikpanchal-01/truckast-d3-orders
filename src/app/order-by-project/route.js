import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "order-by-project.html");
const ASSET_PATH = "/d3-static/OrderByProject_files";

/**
 * Order By Project page — search for customers/projects to place orders.
 */
export async function GET() {
  try {
    let html = await readFile(TEMPLATE_PATH, "utf8");

    // Fix relative asset paths to absolute paths
    html = html.split("./OrderByProject_files/").join(ASSET_PATH + "/");

    return new Response(html, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("Error reading order-by-project.html:", error);
    return new Response("Error: " + error.message, { status: 500 });
  }
}
