import { readFile } from "fs/promises";
import { join } from "path";
import { isMarketViewTenant } from "@/lib/tenant-view";

export const dynamic = "force-dynamic";

const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "invite-user-to-company.html");
const ASSET_PATH = "/d3-static/JobsForFixedNodeID_files";

/**
 * D3 "INVITE" form — reached by clicking a customer tile on the ROLLOUT search board.
 * The shell (public/d3-static/invite-user-to-company.html) is the real D3 export and is
 * already wired to /api/admin/customers (company list) and /api/invitations (submit); it
 * simply had no route serving it. Available to every tenant — only the ROLLOUT tile's
 * link differs per tenant, which is handled in rollout-search.html.
 */
export async function GET() {
  try {
    let html = await readFile(TEMPLATE_PATH, "utf8");
    html = html.split("./JobsForFixedNodeID_files/").join(ASSET_PATH + "/");

    // Lets the shell swap "Invite From" from DOLESE to the tenant brand (HMH).
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
    console.error("Error reading invite-user-to-company.html:", error);
    return new Response("Error: " + error.message, { status: 500 });
  }
}
