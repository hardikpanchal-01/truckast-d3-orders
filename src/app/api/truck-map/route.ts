import { getDoleseTruckMap } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  const data = await getDoleseTruckMap(id);
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(data, { headers: { "cache-control": "no-store" } });
}
