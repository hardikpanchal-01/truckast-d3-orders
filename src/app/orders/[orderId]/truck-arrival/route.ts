import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Truck Arrival — serves the D3 "TruckArrival" HTML shell
 * (public/d3-static/truck-arrival.html) directly, no app chrome. The shell is
 * self-dynamic: truck-arrival-live.js reads the order id from the URL
 * (/orders/{id}/truck-arrival) and renders one tile per active truck from
 * /api/truck-arrival. The server only absolutizes the shared Order_files asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "truck-arrival.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
