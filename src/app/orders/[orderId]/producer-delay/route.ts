import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Producer Delay ("DOLESE - DELAY MINUTES") — serves the D3 "AggProducerDelay" HTML shell
 * (public/d3-static/agg-producer-delay.html). The shell is self-dynamic:
 * agg-producer-delay-live.js reads the order id from /orders/{id}/producer-delay, fetches
 * /api/producer-delay and renders one red truck tile per late load. The DOLESE DELAY MIN
 * tile on the order page links here. The server only absolutizes the shared Order_files
 * asset paths.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "agg-producer-delay.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./Order_files/").join("/d3-static/Order_files/");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
