import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

/**
 * Edit Plant — serves the D3 "Edit Plant" HTML shell (public/d3-static/edit-plant.html)
 * with the Mapbox token injected for the map display.
 */
const TEMPLATE_PATH = join(process.cwd(), "public", "d3-static", "edit-plant.html");

export async function GET(): Promise<Response> {
  let html = await readFile(TEMPLATE_PATH, "utf8");
  html = html.split("./JobsForFixedNodeID_files/").join("/d3-static/JobsForFixedNodeID_files/");

  // Inject the Mapbox token so the map can use Mapbox tiles
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN || "";
  html = html.replace(
    "</head>",
    `<script>window.MAPBOX_TOKEN=${JSON.stringify(token)};</script>\n</head>`,
  );

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
