import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

// D3 exact match dummy chart data - Ordered Volume By Contractor
const orderedVolumeByContractor: [number, number][] = [
  [1782864000000, 37171.34],
  [1782950400000, 37046.23],
  [1783036800000, 2965.06],
  [1783123200000, 41.5],
  [1783209600000, 41],
  [1783296000000, 27115.11],
  [1783382400000, 30209.86],
  [1783468800000, 35344.93],
  [1783555200000, 33713.76],
  [1783641600000, 38235.25],
  [1783728000000, 4076.52],
  [1783814400000, 51],
  [1783900800000, 26729.24],
  [1783987200000, 37673.7],
  [1784073600000, 36361.47],
  [1784160000000, 36861.26],
  [1784246400000, 34499.87],
  [1784332800000, 5362.03],
  [1784419200000, 234],
  [1784505600000, 26767.16],
  [1784592000000, 34574.9],
];

// D3 exact match dummy chart data - Viewed Volume By Person (zeros)
const viewedVolumeByPerson: [number, number][] = [
  [1782864000000, 0],
  [1782950400000, 0],
  [1783036800000, 0],
  [1783123200000, 0],
  [1783209600000, 0],
  [1783296000000, 0],
  [1783382400000, 0],
  [1783468800000, 0],
  [1783555200000, 0],
  [1783641600000, 0],
  [1783728000000, 0],
  [1783814400000, 0],
  [1783900800000, 0],
  [1783987200000, 0],
  [1784073600000, 0],
  [1784160000000, 0],
  [1784246400000, 0],
  [1784332800000, 0],
  [1784419200000, 0],
  [1784505600000, 0],
  [1784592000000, 0],
];

export async function GET(request: NextRequest) {
  try {
    const tenant = await getSelectedTenant();
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Mock user data - in production this would query the database based on userId
    const mockUsers: Record<
      string,
      {
        id: string;
        name: string;
        username: string;
        email: string;
        phone: string;
        region: string;
        type: string;
        company: string;
        permissions: {
          truckast: boolean;
          rollout: boolean;
          publish: boolean;
          projects: boolean;
          order: boolean;
          admin: boolean;
        };
        viewedOrders: number;
        viewedOrderVolume: string;
        viewedTickets: number;
        viewedTicketVolume: string;
        socialPosts: number;
        socialComments: number;
        pictureUploads: number;
        orderRequests: number;
        orderRequestPosts: number;
        invitedBy: string;
        inviteDate: string;
        lastAccess: string;
        accessRange: string;
        lastOrderDate: string;
      }
    > = {
      "1": {
        id: "1",
        name: "John Smith",
        username: "jsmith@email.com",
        email: "jsmith@email.com",
        phone: "5551234567",
        region: "DALLAS",
        type: "CONTRACTOR",
        company: "ABC Construction",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: true,
          order: true,
          admin: false,
        },
        viewedOrders: 145,
        viewedOrderVolume: "12,450 CY",
        viewedTickets: 892,
        viewedTicketVolume: "8,234 CY",
        socialPosts: 12,
        socialComments: 45,
        pictureUploads: 8,
        orderRequests: 67,
        orderRequestPosts: 23,
        invitedBy: "admin@company.com",
        inviteDate: "2023-06-15",
        lastAccess: "2025-05-22",
        accessRange: "2026-01-23 - 2026-07-22",
        lastOrderDate: "2026-07-20",
      },
      "2": {
        id: "2",
        name: "Jane Doe",
        username: "jdoe@contractor.com",
        email: "jdoe@contractor.com",
        phone: "5559876543",
        region: "HOUSTON",
        type: "CONTRACTOR",
        company: "XYZ Builders",
        permissions: {
          truckast: true,
          rollout: true,
          publish: false,
          projects: true,
          order: true,
          admin: false,
        },
        viewedOrders: 234,
        viewedOrderVolume: "18,920 CY",
        viewedTickets: 1245,
        viewedTicketVolume: "15,670 CY",
        socialPosts: 28,
        socialComments: 89,
        pictureUploads: 15,
        orderRequests: 112,
        orderRequestPosts: 45,
        invitedBy: "manager@company.com",
        inviteDate: "2023-03-20",
        lastAccess: "2026-07-21",
        accessRange: "2026-01-23 - 2026-07-22",
        lastOrderDate: "2026-07-21",
      },
      "3": {
        id: "3",
        name: "Wayne Poston",
        username: "wayne.poston@concretesupplyco.com",
        email: "wayne.poston@concretesupplyco.com",
        phone: "7046174393",
        region: "",
        type: "PRODUCER",
        company: "",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: false,
          order: false,
          admin: false,
        },
        viewedOrders: 0,
        viewedOrderVolume: "",
        viewedTickets: 0,
        viewedTicketVolume: "",
        socialPosts: 0,
        socialComments: 0,
        pictureUploads: 0,
        orderRequests: 0,
        orderRequestPosts: 0,
        invitedBy: "Hunter Willm",
        inviteDate: "",
        lastAccess: "2025-05-22",
        accessRange: "2026-01-23 - 2026-07-22",
        lastOrderDate: "",
      },
      "4": {
        id: "4",
        name: "Shane Gibbs",
        username: "sgibbs@palmettocorp.net",
        email: "Sgibbs@palmettocorp.net",
        phone: "8434650880",
        region: "DAWKINS",
        type: "CONTRACTOR",
        company: "Palmetto Concrete Finishing",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: false,
          order: false,
          admin: false,
        },
        viewedOrders: 0,
        viewedOrderVolume: "",
        viewedTickets: 0,
        viewedTicketVolume: "",
        socialPosts: 0,
        socialComments: 0,
        pictureUploads: 0,
        orderRequests: 0,
        orderRequestPosts: 0,
        invitedBy: "Marlin Poston",
        inviteDate: "",
        lastAccess: "",
        accessRange: "2026-01-23 - 2026-07-22",
        lastOrderDate: "",
      },
      "5": {
        id: "5",
        name: "Houston Neves",
        username: "houston.neves@concretesupplyco.com",
        email: "houston.neves@concretesupplyco.com",
        phone: "",
        region: "",
        type: "PRODUCER",
        company: "",
        permissions: {
          truckast: true,
          rollout: false,
          publish: false,
          projects: false,
          order: false,
          admin: false,
        },
        viewedOrders: 0,
        viewedOrderVolume: "",
        viewedTickets: 0,
        viewedTicketVolume: "",
        socialPosts: 0,
        socialComments: 0,
        pictureUploads: 0,
        orderRequests: 0,
        orderRequestPosts: 0,
        invitedBy: "",
        inviteDate: "",
        lastAccess: "07/19/2026",
        accessRange: "2026-01-23 - 2026-07-22",
        lastOrderDate: "",
      },
    };

    // Get user data or return default
    const userData = mockUsers[userId] || {
      id: userId,
      name: "Unknown User",
      username: "unknown@email.com",
      email: "unknown@email.com",
      phone: "",
      region: "",
      type: "PRODUCER",
      company: "",
      permissions: {
        truckast: false,
        rollout: false,
        publish: false,
        projects: false,
        order: false,
        admin: false,
      },
      viewedOrders: 0,
      viewedOrderVolume: "",
      viewedTickets: 0,
      viewedTicketVolume: "",
      socialPosts: 0,
      socialComments: 0,
      pictureUploads: 0,
      orderRequests: 0,
      orderRequestPosts: 0,
      invitedBy: "",
      inviteDate: "",
      lastAccess: "",
      accessRange: "",
      lastOrderDate: "",
    };

    // Use D3 exact match dummy chart data
    const ordersVolumeChart = orderedVolumeByContractor;
    const viewedVolumeChart = viewedVolumeByPerson;
    const ticketVolumeChart = orderedVolumeByContractor; // Same data for tickets
    const viewedTicketVolumeChart = viewedVolumeByPerson;

    // Generate sample orders viewed data
    const ordersViewed =
      userData.viewedOrders > 0
        ? [
            {
              scheduledDate: "2026-07-20",
              orderNumber: "ORD-2024-001",
              viewedCY: "125.5",
              status: "Delivered",
              viewDate: "2026-07-20 14:30",
              otherViewers: "2",
              project: "Downtown Plaza",
              contractorCompanies: "ABC Construction",
              businessUnit: "DALLAS",
            },
            {
              scheduledDate: "2026-07-19",
              orderNumber: "ORD-2024-002",
              viewedCY: "89.0",
              status: "Delivered",
              viewDate: "2026-07-19 10:15",
              otherViewers: "1",
              project: "Highway Extension",
              contractorCompanies: "XYZ Builders",
              businessUnit: "HOUSTON",
            },
          ]
        : [];

    // Generate sample tickets viewed data
    const ticketsViewed =
      userData.viewedTickets > 0
        ? [
            {
              scheduledDate: "2026-07-20",
              orderNumber: "ORD-2024-001",
              ticketNumber: "TKT-001",
              viewedCY: "10.5",
              status: "Delivered",
              viewDate: "2026-07-20 14:35",
              otherViewers: "1",
              project: "Downtown Plaza",
              contractorCompanies: "ABC Construction",
              businessUnit: "DALLAS",
            },
            {
              scheduledDate: "2026-07-20",
              orderNumber: "ORD-2024-001",
              ticketNumber: "TKT-002",
              viewedCY: "10.5",
              status: "Delivered",
              viewDate: "2026-07-20 14:40",
              otherViewers: "0",
              project: "Downtown Plaza",
              contractorCompanies: "ABC Construction",
              businessUnit: "DALLAS",
            },
          ]
        : [];

    return NextResponse.json({
      success: true,
      data: {
        ...userData,
        ordersViewed,
        ticketsViewed,
        ordersVolumeChart,
        viewedVolumeChart,
        ticketVolumeChart,
        viewedTicketVolumeChart,
        screenViewChart: [],
      },
    });
  } catch (error) {
    console.error("Error fetching individual user data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
