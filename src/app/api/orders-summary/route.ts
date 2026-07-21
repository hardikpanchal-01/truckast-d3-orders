import { getDoleseSummary } from "@/actions/orderActions";

export const dynamic = "force-dynamic";

/**
 * Live summary feed for the D3 orders page: the plant total (selected DOLESE
 * option) and the display date, regenerated from the database on each call so
 * the shell can fill them in dynamically on the client.
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const today = new Date().toISOString().slice(0, 10);
  const dateStr = searchParams.get("date") || today;
  const dateToStr = searchParams.get("dateTo") || undefined; // range end (Last 7 / month / Future / …)

  const summary = await getDoleseSummary(dateStr, dateToStr);
  // Concrete is ordered in half-yard increments, so D3 shows the plant total to
  // the nearest 0.50 (e.g. 4,877.00). Round to match and kill float artifacts.
  const totalLabel = (Math.round(summary.totalCY * 2) / 2).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const mdy = (s: string) => { const [y, m, d] = s.split("-"); return `${m}/${d}/${y}`; };
  const dateLabel = dateToStr ? `${mdy(dateStr)} - ${mdy(dateToStr)}` : mdy(dateStr);

  return Response.json(
    { totalLabel, dateLabel },
    { headers: { "cache-control": "no-store" } },
  );
}
