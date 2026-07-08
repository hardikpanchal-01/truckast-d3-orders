import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Truck Map — serves the D3 "TruckMap" HTML shell (public/d3-static/truck-map.html)
 * directly. The shell is self-dynamic: truck-map-live.js reads the order id from the URL
 * (/orders/{id}/truckmap) and renders the map + tables from /api/truck-map. The server
 * only absolutizes the shared Order_files asset paths. The TRUCKS "MAP" tile links here.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "truck-map.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
