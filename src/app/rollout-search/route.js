import { readFile } from "fs/promises";
import { join } from "path";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "rollout-search.html");
const ASSET_PATH = "/d3-static/JobsForFixedNodeID_files";

/**
 * Rollout Search page — returns the D3 "Search" HTML document
 * which uses jQuery AJAX to call /api/rollout/customers for search.
 */
export async function GET() {
  try {
    let html = await readFile(TEMPLATE_PATH, "utf8");

    // Fix relative asset paths to absolute paths
    html = html.split("./JobsForFixedNodeID_files/").join(ASSET_PATH + "/");

    // Hercules renders the search-result tiles amber instead of D3 green; the flag lets
    // createCustomerTile() pick the colour. No other tenant sees it.
    if (await isMarketViewTenant()) {
      html = html.replace("</head>", "<script>window.__MARKET_VIEW__=true;</script>\n</head>");
    }

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
