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

    // User data structure type
    interface UserData {
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

    // Mock user data - maps UUID-style IDs to user info (matching User Search data)
    const mockUsers: Record<string, UserData> = {
      "45730710-F09A-EC11-82C9-22000A29EF36": {
        id: "45730710-F09A-EC11-82C9-22000A29EF36",
        name: "SHANITA SPEAKS",
        username: "shanita.speaks@concretesupplyco.com",
        email: "shanita.speaks@concretesupplyco.com",
        phone: "704-555-0101",
        region: "CHARLOTTE",
        type: "PRODUCER",
        company: "Concrete Supply Co",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false },
        viewedOrders: 0, viewedOrderVolume: "", viewedTickets: 0, viewedTicketVolume: "",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "", inviteDate: "", lastAccess: "07/22/2026", accessRange: "2026-01-23 - 2026-07-22", lastOrderDate: ""
      },
      "DFEB1073-92CB-EC11-82C9-22000A29EF36": {
        id: "DFEB1073-92CB-EC11-82C9-22000A29EF36",
        name: "CAMERON PARKER",
        username: "cameron.parker@concretesupplyco.com",
        email: "cameron.parker@concretesupplyco.com",
        phone: "704-555-0102",
        region: "CHARLOTTE",
        type: "PRODUCER",
        company: "Concrete Supply Co",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false },
        viewedOrders: 0, viewedOrderVolume: "", viewedTickets: 0, viewedTicketVolume: "",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "", inviteDate: "", lastAccess: "07/20/2026", accessRange: "2026-01-23 - 2026-07-22", lastOrderDate: ""
      },
      "421E43E0-F530-E811-80F8-22000B772084": {
        id: "421E43E0-F530-E811-80F8-22000B772084",
        name: "MICHAEL WALKER",
        username: "michael@raywalkertrucking.com",
        email: "michael@raywalkertrucking.com",
        phone: "704-555-0103",
        region: "DAWKINS",
        type: "CONTRACTOR",
        company: "Ray Walker Trucking",
        permissions: { truckast: true, rollout: false, publish: false, projects: true, order: true, admin: false },
        viewedOrders: 45, viewedOrderVolume: "3,450 CY", viewedTickets: 120, viewedTicketVolume: "2,100 CY",
        socialPosts: 5, socialComments: 12, pictureUploads: 3, orderRequests: 28, orderRequestPosts: 8,
        invitedBy: "Keith Mintz", inviteDate: "03/15/2018", lastAccess: "07/21/2026", accessRange: "2026-01-23 - 2026-07-22", lastOrderDate: "07/21/2026"
      },
      "E659103C-5828-E511-80F2-22000B39E0BB": {
        id: "E659103C-5828-E511-80F2-22000B39E0BB",
        name: "CSCDEMO USER",
        username: "cscuser@truckast.com",
        email: "cscuser@truckast.com",
        phone: "704-555-0134",
        region: "",
        type: "PRODUCER",
        company: "",
        permissions: { truckast: true, rollout: true, publish: true, projects: true, order: true, admin: true },
        viewedOrders: 250, viewedOrderVolume: "18,500 CY", viewedTickets: 890, viewedTicketVolume: "12,300 CY",
        socialPosts: 15, socialComments: 45, pictureUploads: 8, orderRequests: 56, orderRequestPosts: 22,
        invitedBy: "Admin", inviteDate: "01/01/2015", lastAccess: "07/22/2026", accessRange: "2026-01-23 - 2026-07-22", lastOrderDate: "07/22/2026"
      },
      "43E42E92-5C4A-E511-80F2-22000B39E0BB": {
        id: "43E42E92-5C4A-E511-80F2-22000B39E0BB",
        name: "KEITH MINTZ",
        username: "keith.mintz@concretesupplyco.com",
        email: "keith.mintz@concretesupplyco.com",
        phone: "704-555-0135",
        region: "CHARLOTTE",
        type: "PRODUCER",
        company: "Concrete Supply Co",
        permissions: { truckast: true, rollout: true, publish: false, projects: true, order: true, admin: true },
        viewedOrders: 180, viewedOrderVolume: "14,200 CY", viewedTickets: 650, viewedTicketVolume: "9,800 CY",
        socialPosts: 22, socialComments: 67, pictureUploads: 12, orderRequests: 89, orderRequestPosts: 34,
        invitedBy: "Admin", inviteDate: "06/15/2015", lastAccess: "07/22/2026", accessRange: "2026-01-23 - 2026-07-22", lastOrderDate: "07/22/2026"
      },
      // Contractor Users from User Dashboard
      "761831C7-888E-E311-8466-A7697EBE67DC": {
        id: "761831C7-888E-E311-8466-A7697EBE67DC",
        name: "rich mayer",
        username: "rich@acsgreer.com",
        email: "rich@acsgreer.com",
        phone: "8644040817",
        region: "AMERICAN CONCRETE & PRECAST",
        type: "CONTRACTOR",
        company: "AMERICAN CONCRETE SERVICES",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false },
        viewedOrders: 239, viewedOrderVolume: "10637.61 CY", viewedTickets: 7, viewedTicketVolume: "50.00 CY",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 1, orderRequestPosts: 0,
        invitedBy: "Todd Wade", inviteDate: "06/20/2018", lastAccess: "07/23/2026", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: "07/23/2026"
      },
      "8CF38A7F-2F8D-E911-80F9-22000B772084": {
        id: "8CF38A7F-2F8D-E911-80F9-22000B772084",
        name: "Manly McCroskey",
        username: "manly@acsgreer.com",
        email: "manly@acsgreer.com",
        phone: "",
        region: "AMERICAN CONCRETE & PRECAST",
        type: "CONTRACTOR",
        company: "AMERICAN CONCRETE SERVICES",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false },
        viewedOrders: 156, viewedOrderVolume: "8,245 CY", viewedTickets: 23, viewedTicketVolume: "345 CY",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "Todd Wade", inviteDate: "06/12/2019", lastAccess: "07/23/2026", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: "07/23/2026"
      },
      "43101886-D1E1-E811-80F9-22000B772084": {
        id: "43101886-D1E1-E811-80F9-22000B772084",
        name: "Jerry Bowers",
        username: "jerry@bandpoolsinc.com",
        email: "jerry@bandpoolsinc.com",
        phone: "",
        region: "AMERICAN CONCRETE & PRECAST",
        type: "CONTRACTOR",
        company: "B&B POOLS INC",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false },
        viewedOrders: 0, viewedOrderVolume: "", viewedTickets: 0, viewedTicketVolume: "",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "Doyle Rogers", inviteDate: "11/06/2018", lastAccess: "User has not logged in", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: ""
      },
      "E041011F-D2E1-E811-80F9-22000B772084": {
        id: "E041011F-D2E1-E811-80F9-22000B772084",
        name: "Deano Stone",
        username: "deano@bandbpoolsinc.com",
        email: "deano@bandbpoolsinc.com",
        phone: "",
        region: "AMERICAN CONCRETE & PRECAST",
        type: "CONTRACTOR",
        company: "B&B POOLS INC",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false },
        viewedOrders: 0, viewedOrderVolume: "", viewedTickets: 0, viewedTicketVolume: "",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "Doyle Rogers", inviteDate: "11/06/2018", lastAccess: "User has not logged in", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: ""
      },
      // Producer Users from User Dashboard
      "EDAF309D-6B8A-F011-82CB-DB25CFADDFDF": {
        id: "EDAF309D-6B8A-F011-82CB-DB25CFADDFDF",
        name: "Houston Neves",
        username: "houston.neves@concretesupplyco.com",
        email: "houston.neves@concretesupplyco.com",
        phone: "",
        region: "ACP&UPSTATE",
        type: "PRODUCER",
        company: "Concrete Supply Co",
        permissions: { truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false },
        viewedOrders: 0, viewedOrderVolume: "", viewedTickets: 0, viewedTicketVolume: "",
        socialPosts: 0, socialComments: 0, pictureUploads: 0, orderRequests: 0, orderRequestPosts: 0,
        invitedBy: "", inviteDate: "", lastAccess: "07/19/2026", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: ""
      },
      "6D4F7A6C-5C9B-ED11-82CA-F365D7555AC1": {
        id: "6D4F7A6C-5C9B-ED11-82CA-F365D7555AC1",
        name: "Jacob Clary",
        username: "jacob.clary@concretesupplyco.com",
        email: "jacob.clary@concretesupplyco.com",
        phone: "",
        region: "ACP&UPSTATE",
        type: "PRODUCER",
        company: "Concrete Supply Co",
        permissions: { truckast: true, rollout: true, publish: false, projects: false, order: true, admin: false },
        viewedOrders: 89, viewedOrderVolume: "5,230 CY", viewedTickets: 234, viewedTicketVolume: "2,100 CY",
        socialPosts: 5, socialComments: 12, pictureUploads: 2, orderRequests: 15, orderRequestPosts: 3,
        invitedBy: "Admin", inviteDate: "01/15/2023", lastAccess: "07/23/2026", accessRange: "01/23/2026 - 07/23/2026", lastOrderDate: "07/23/2026"
      },
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

    // Basic user lookup for names/emails (from User Search data)
    const userBasicInfo: Record<string, { name: string; email: string; phone: string }> = {
      "45730710-F09A-EC11-82C9-22000A29EF36": { name: "SHANITA SPEAKS", email: "shanita.speaks@concretesupplyco.com", phone: "704-555-0101" },
      "DFEB1073-92CB-EC11-82C9-22000A29EF36": { name: "CAMERON PARKER", email: "cameron.parker@concretesupplyco.com", phone: "704-555-0102" },
      "421E43E0-F530-E811-80F8-22000B772084": { name: "MICHAEL WALKER", email: "michael@raywalkertrucking.com", phone: "704-555-0103" },
      "EF9E40A9-5C80-EB11-82C9-22000A29EF36": { name: "MATT CATO", email: "mbcato@dawkinsonsite.com", phone: "704-555-0104" },
      "68073388-7214-F011-82CB-DB25CFADDFDF": { name: "RICHARD KAUFFMAN", email: "richard.kauffman@concretesupplyco.com", phone: "704-555-0105" },
      "EAFD44EA-B3A3-EB11-82C9-22000A29EF36": { name: "KYLE RICE", email: "spartanburgacp@american-concrete.com", phone: "704-555-0106" },
      "E5E786D0-C15B-EC11-82C9-22000A29EF36": { name: "JACK JONES", email: "jjones@carolinareadymixinc.com", phone: "704-555-0107" },
      "BD37A16F-8D69-E811-80F9-22000B772084": { name: "GARY KILKER", email: "gkilker@carolinareadymixinc.com", phone: "704-555-0108" },
      "0F2DF11C-2773-E811-80F9-22000B772084": { name: "STANLEY BUCKNER", email: "sbuckner@carolinareadymixinc.com", phone: "704-555-0109" },
      "81C4D14F-2773-E811-80F9-22000B772084": { name: "MARK DAVIS", email: "mdavis@carolinareadymixinc.com", phone: "704-555-0110" },
      "7E5D4BA3-DD26-F111-82CC-9F6F49760254": { name: "JACKIE MILLS", email: "jmills@carolinareadymixinc.com", phone: "704-555-0111" },
      "1EB2B5EB-E5C9-EF11-82CB-DB25CFADDFDF": { name: "GABE KIRKPATRICK", email: "gkirkpatrick@carolinareadymixinc.com", phone: "704-555-0112" },
      "E4BDBA55-96CA-EA11-82C8-22000AA7BA04": { name: "CHARLESTON MARKET", email: "charleston@concretesupplyco.com", phone: "704-555-0113" },
      "9CB92E86-F659-ED11-82CA-F365D7555AC1": { name: "WAYLON WOODCOCK", email: "waylon.woodcock@concretesupplyco.com", phone: "704-555-0114" },
      "3AF47E2E-0B3C-EC11-82C9-22000A29EF36": { name: "T.J. ROBINETTE", email: "kingsmtn@concretesupplyco.com", phone: "704-555-0115" },
      "35144805-11EC-EC11-82C9-22000A29EF36": { name: "RICK BIGHAM", email: "rick.bigham@concretesupplyco.com", phone: "704-555-0116" },
      "C4583C5A-1D36-EA11-82C8-22000AA7BA04": { name: "ERIK SNYDER", email: "erik.snyder@concretesupplyco.com", phone: "704-555-0117" },
      "C9E46BBD-E052-E811-80F9-22000B772084": { name: "JIM ROEBUCK", email: "jim.roebuck@concretesupplyco.com", phone: "704-555-0118" },
      "5B19328F-FA6A-EB11-82C8-22000AA7BA04": { name: "CURRY DAWKING", email: "curry@dawkinsconcrete.com", phone: "704-555-0119" },
      "D393E9F9-3A0C-F111-82CC-9F6F49760254": { name: "CINDY STEVENSON", email: "cindy@dawkinsconcrete.com", phone: "704-555-0120" },
      "63B74B0D-3B0C-F111-82CC-9F6F49760254": { name: "WAYNE GARNER", email: "wayne@dawkinsconcrete.com", phone: "704-555-0121" },
      "785B7BB1-44B7-EB11-82C9-22000A29EF36": { name: "SEAN VANDYKE", email: "sean.vandyke@concretesupplyco.com", phone: "704-555-0122" },
      "F1603151-5742-EC11-82C9-22000A29EF36": { name: "NOKIA GOINS", email: "nokia.goins@concretesupplyco.com", phone: "704-555-0123" },
      "1308831B-DFEE-EA11-82C8-22000AA7BA04": { name: "MARK ARMSTRONG", email: "mark.armstrong@concretesupplyco.com", phone: "704-555-0124" },
      "4F633248-2E5D-E911-80F9-22000B772084": { name: "MIKE CLINE", email: "mike.cline@concretesupplyco.com", phone: "704-555-0125" },
      "214F54D2-E1ED-EF11-82CB-DB25CFADDFDF": { name: "DREW STANKWYTCH", email: "drew.stankwytch@concretesupplyco.com", phone: "704-555-0126" },
      "AEFD42F7-E1ED-EF11-82CB-DB25CFADDFDF": { name: "TIM KINDER", email: "tim.kinder@concretesupplyco.com", phone: "704-555-0127" },
      "4134E5AC-26DE-ED11-82CA-F365D7555AC1": { name: "NAKOA GOINS", email: "nakoa.goins@concretesupplyco.com", phone: "704-555-0128" },
      "927C5C6E-1D62-EE11-82CA-F365D7555AC1": { name: "ANDRE SHANKS", email: "andre.shanks@concretesupplyco.com", phone: "704-555-0129" },
      "15DA80C3-E3EA-EF11-82CB-DB25CFADDFDF": { name: "RAHAB KAGURU", email: "rahab.kaguru@concretesupplyco.com", phone: "704-555-0130" },
      "8772ADA9-18D6-EC11-82C9-22000A29EF36": { name: "KASEY TURNER", email: "kasey.turner@concretesupplyco.com", phone: "704-555-0131" },
      "634B103A-24E1-E911-82C8-22000AA7BA04": { name: "MIKE VALENTINE", email: "mike.valentine@concretesupplyco.com", phone: "704-555-0132" },
      "8BAFEC43-7AC7-EA11-82C8-22000AA7BA04": { name: "RICKY MILLER", email: "ricky.miller@concretesupplyco.com", phone: "704-555-0133" },
      "E659103C-5828-E511-80F2-22000B39E0BB": { name: "CSCDEMO USER", email: "cscuser@truckast.com", phone: "704-555-0134" },
      "43E42E92-5C4A-E511-80F2-22000B39E0BB": { name: "KEITH MINTZ", email: "keith.mintz@concretesupplyco.com", phone: "704-555-0135" },
      "C4D3F283-0096-E611-80F8-22000B772084": { name: "SHAUN KNIGHT", email: "shaun.knight@concretesupplyco.com", phone: "704-555-0136" },
      "5F3354B4-0A32-E811-80F8-22000B772084": { name: "JOHN EVANS", email: "johnevansreynolds@outlook.com", phone: "704-555-0137" },
      "51C5D915-C871-E911-80F9-22000B772084": { name: "NICK NICHOLSON", email: "nick.nicholson@concretesupplyco.com", phone: "704-555-0138" },
      "33F706FE-EA58-F111-82CC-9F6F49760254": { name: "MARK THOMAS", email: "mark.thomas@concretesupplyco.com", phone: "704-555-0139" },
      "03ABA722-EB58-F111-82CC-9F6F49760254": { name: "NICK GRIZZELL", email: "nicholas.grizzell@concretesupplyco.com", phone: "704-555-0140" },
      "C815618F-5F59-F111-82CC-9F6F49760254": { name: "DERRICK HAWKS", email: "derrick.hawks@centralcarolinaconcrete.com", phone: "704-555-0141" },
    };

    // Get user basic info or defaults
    const basicInfo = userBasicInfo[userId] || { name: "Unknown User", email: "unknown@email.com", phone: "" };

    // Get user data or return default with basic info
    const userData = mockUsers[userId] || {
      id: userId,
      name: basicInfo.name,
      username: basicInfo.email,
      email: basicInfo.email,
      phone: basicInfo.phone,
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
      accessRange: "2026-01-23 - 2026-07-22",
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
