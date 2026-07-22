import { NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

export async function GET() {
  try {
    const tenant = await getSelectedTenant();

    // Mock data - in production this would query the database
    const mockUsers = [
      {
        id: "1",
        fullName: "John Smith",
        username: "jsmith@email.com",
        customer: "ABC Construction",
        account: "ABC-001",
        region: "DALLAS",
        lastAccess: "2024-01-15 14:30",
        invitedBy: "admin@company.com",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: true,
          order: true,
          admin: false,
          analytics: false,
        },
      },
      {
        id: "2",
        fullName: "Jane Doe",
        username: "jdoe@contractor.com",
        customer: "XYZ Builders",
        account: "XYZ-002",
        region: "HOUSTON",
        lastAccess: "2024-01-14 09:15",
        invitedBy: "manager@company.com",
        permissions: {
          truckast: true,
          rollout: true,
          publish: false,
          projects: true,
          order: true,
          admin: false,
          analytics: true,
        },
      },
      {
        id: "3",
        fullName: "Mike Johnson",
        username: "mjohnson@build.com",
        customer: "Premier Construction",
        account: "PRM-003",
        region: "AUSTIN",
        lastAccess: "2024-01-13 16:45",
        invitedBy: "admin@company.com",
        permissions: {
          truckast: true,
          rollout: false,
          publish: true,
          projects: true,
          order: true,
          admin: false,
          analytics: false,
        },
      },
      {
        id: "4",
        fullName: "Sarah Williams",
        username: "swilliams@concrete.com",
        customer: "Williams Contractors",
        account: "WLC-004",
        region: "SAN ANTONIO",
        lastAccess: "2024-01-12 11:20",
        invitedBy: "sales@company.com",
        permissions: {
          truckast: true,
          rollout: true,
          publish: false,
          projects: false,
          order: true,
          admin: false,
          analytics: false,
        },
      },
      {
        id: "5",
        fullName: "Robert Brown",
        username: "rbrown@builders.net",
        customer: "Brown & Sons",
        account: "BRS-005",
        region: "FORT WORTH",
        lastAccess: "2024-01-11 08:00",
        invitedBy: "admin@company.com",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: true,
          order: true,
          admin: true,
          analytics: true,
        },
      },
    ];

    return NextResponse.json({
      success: true,
      data: mockUsers,
    });
  } catch (error) {
    console.error("Error fetching contractor users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch contractors" },
      { status: 500 }
    );
  }
}
