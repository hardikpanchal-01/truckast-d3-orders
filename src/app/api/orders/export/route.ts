import { NextRequest, NextResponse } from "next/server";
import { getDoleseOrders } from "@/actions/orderActions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  try {
    const orders = await getDoleseOrders(date);

    // Generate CSV content
    const headers = [
      "Order Code",
      "Order Date",
      "Customer",
      "Delivery Address",
      "Project",
      "Ordered CY",
      "Ticketed CY",
      "Status",
    ];

    const rows = orders.map((o) => [
      o.order_code,
      o.order_date,
      o.customer_name || "",
      o.delivery_addr1 || "",
      o.project_name || "",
      o.ordered_cy.toFixed(2),
      o.ticketed_cy.toFixed(2),
      o.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const filename = `orders-${date}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export orders" }, { status: 500 });
  }
}
