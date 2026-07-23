import { NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

export async function GET() {
  try {
    const tenant = await getSelectedTenant();

    // Mock data - in production this would query the database
    const mockUsers = [
      {
        id: "1",
        name: "Admin User",
        username: "admin@concretesupply.com",
        truckastRole: "Super Admin",
        lastAccess: "2024-01-15 14:30",
        permissions: {
          truckast: true,
          publish: true,
          projects: true,
          order: true,
          admin: true,
        },
      },
      {
        id: "2",
        name: "Plant Manager",
        username: "plant1@concretesupply.com",
        truckastRole: "Plant Manager",
        lastAccess: "2024-01-15 12:00",
        permissions: {
          truckast: true,
          publish: true,
          projects: true,
          order: true,
          admin: false,
        },
      },
      {
        id: "3",
        name: "Dispatch User",
        username: "dispatch@concretesupply.com",
        truckastRole: "Dispatcher",
        lastAccess: "2024-01-15 10:45",
        permissions: {
          truckast: true,
          publish: false,
          projects: false,
          order: true,
          admin: false,
        },
      },
      {
        id: "4",
        name: "Sales Rep",
        username: "sales@concretesupply.com",
        truckastRole: "Sales",
        lastAccess: "2024-01-14 16:20",
        permissions: {
          truckast: true,
          publish: false,
          projects: true,
          order: true,
          admin: false,
        },
      },
      {
        id: "5",
        name: "QC Manager",
        username: "qc@concretesupply.com",
        truckastRole: "QC Manager",
        lastAccess: "2024-01-14 09:30",
        permissions: {
          truckast: true,
          publish: true,
          projects: false,
          order: false,
          admin: false,
        },
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockUsers,
    });
  } catch (error) {
    console.error("Error fetching producer users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch producers" },
      { status: 500 }
    );
  }
}
