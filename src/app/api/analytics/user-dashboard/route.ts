import { NextRequest, NextResponse } from "next/server";

interface ContractorUser {
  id: string;
  fullName: string;
  username: string;
  customer: string;
  account: string;
  region: string;
  lastAccess: string;
  invitedBy: string;
  invitedDate: string;
  truckast: boolean;
  rollout: boolean;
  publish: boolean;
  projects: boolean;
  order: boolean;
  admin: boolean;
  analytics: boolean;
}

interface ProducerUser {
  id: string;
  name: string;
  username: string;
  truckastRole: string;
  lastAccess: string;
  truckast: boolean;
  rollout: boolean;
  publish: boolean;
  projects: boolean;
  order: boolean;
  admin: boolean;
  analytics: boolean;
}

// Mock Contractor Users data
const CONTRACTOR_USERS: ContractorUser[] = [
  { id: "761831C7-888E-E311-8466-A7697EBE67DC", fullName: "rich mayer", username: "rich@acsgreer.com", customer: "AMERICAN CONCRETE SERVICES", account: "ACP10002", region: "American Concrete & Precast", lastAccess: "07/23/2026", invitedBy: "Todd Wade", invitedDate: "02/05/2014", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "8CF38A7F-2F8D-E911-80F9-22000B772084", fullName: "Manly McCroskey", username: "manly@acsgreer.com", customer: "AMERICAN CONCRETE SERVICES", account: "ACP10002", region: "American Concrete & Precast", lastAccess: "07/23/2026", invitedBy: "Todd Wade", invitedDate: "06/12/2019", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "B38FF7AC-E38D-E311-8466-A7697EBE67DC", fullName: "Andy Shaw", username: "Americanconcreteservices@yahoo.com", customer: "AMERICAN CONCRETE SERVICES", account: "ACP10002", region: "American Concrete & Precast", lastAccess: "User has not logged in", invitedBy: "Todd Wade", invitedDate: "02/04/2014", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "43101886-D1E1-E811-80F9-22000B772084", fullName: "Jerry Bowers", username: "jerry@bandpoolsinc.com", customer: "B&B POOLS INC", account: "ACP10358", region: "American Concrete & Precast", lastAccess: "User has not logged in", invitedBy: "Doyle Rogers", invitedDate: "11/06/2018", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "E041011F-D2E1-E811-80F9-22000B772084", fullName: "Deano Stone", username: "deano@bandbpoolsinc.com", customer: "B&B POOLS INC", account: "ACP10358", region: "American Concrete & Precast", lastAccess: "User has not logged in", invitedBy: "Doyle Rogers", invitedDate: "11/06/2018", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "3721B762-B4A0-E811-80F9-22000B772084", fullName: "Zach Carter", username: "zcarter@foundationsunlimited.net", customer: "FOUNDATIONS UNLIMITED LLC", account: "ACP11281", region: "American Concrete & Precast", lastAccess: "User has not logged in", invitedBy: "Todd Wade", invitedDate: "08/15/2018", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "B180C3EB-E0AF-E611-80F8-22000B772084", fullName: "Todd Bayne", username: "tbayne@foundationsunlimited.net", customer: "FOUNDATIONS UNLIMITED LLC", account: "ACP11281", region: "American Concrete & Precast", lastAccess: "User has not logged in", invitedBy: "Todd Wade", invitedDate: "11/21/2016", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "B18CCAB1-511E-E911-80F9-22000B772084", fullName: "Brent Lindley", username: "blindley@foundationsunlimited.net", customer: "FOUNDATIONS UNLIMITED LLC", account: "ACP11281", region: "American Concrete & Precast", lastAccess: "07/23/2026", invitedBy: "Rip Case", invitedDate: "01/22/2019", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "D65EA582-DBB2-E911-80F9-22000B772084", fullName: "Jerry Rangel", username: "grpremiumconcrete@gmail.com", customer: "GR PREMIUM CONCRETE, INC", account: "ACP17944", region: "American Concrete & Precast", lastAccess: "02/18/2026", invitedBy: "Kyle Brown", invitedDate: "07/30/2019", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "1F7A880C-8250-4E43-838D-741BC6FEBE35", fullName: "Ramiro Montalvo", username: "ramiro.m@jcbuildinginc.com", customer: "JC BUILDING, INC", account: "CSC18503", region: "American Concrete & Precast", lastAccess: "01/24/2025", invitedBy: "Buchanan Coleman", invitedDate: "11/13/2023", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "421E43E0-F530-E811-80F8-22000B772084", fullName: "Michael Walker", username: "michael@raywalkertrucking.com", customer: "RAY WALKER TRUCKING", account: "CSC12001", region: "Dawkins", lastAccess: "07/21/2026", invitedBy: "Keith Mintz", invitedDate: "03/15/2018", truckast: true, rollout: false, publish: false, projects: true, order: true, admin: false, analytics: false },
  { id: "EF9E40A9-5C80-EB11-82C9-22000A29EF36", fullName: "Matt Cato", username: "mbcato@dawkinsonsite.com", customer: "DAWKINS ON SITE CONCRETE", account: "CSC14005", region: "Dawkins", lastAccess: "07/20/2026", invitedBy: "Cindy Stevenson", invitedDate: "06/10/2021", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "5B19328F-FA6A-EB11-82C8-22000AA7BA04", fullName: "Curry Dawking", username: "curry@dawkinsconcrete.com", customer: "DAWKINS CONCRETE", account: "CSC10001", region: "Dawkins", lastAccess: "07/22/2026", invitedBy: "Admin", invitedDate: "01/15/2021", truckast: true, rollout: true, publish: false, projects: true, order: true, admin: true, analytics: true },
  { id: "D393E9F9-3A0C-F111-82CC-9F6F49760254", fullName: "Cindy Stevenson", username: "cindy@dawkinsconcrete.com", customer: "DAWKINS CONCRETE", account: "CSC10001", region: "Dawkins", lastAccess: "07/21/2026", invitedBy: "Admin", invitedDate: "05/20/2024", truckast: true, rollout: false, publish: false, projects: true, order: true, admin: false, analytics: true },
  { id: "63B74B0D-3B0C-F111-82CC-9F6F49760254", fullName: "Wayne Garner", username: "wayne@dawkinsconcrete.com", customer: "DAWKINS CONCRETE", account: "CSC10001", region: "Dawkins", lastAccess: "07/19/2026", invitedBy: "Admin", invitedDate: "05/20/2024", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
];

// Mock Producer Users data
const PRODUCER_USERS: ProducerUser[] = [
  { id: "EDAF309D-6B8A-F011-82CB-DB25CFADDFDF", name: "Houston Neves", username: "houston.neves@concretesupplyco.com", truckastRole: "ACP&UPSTATE", lastAccess: "07/19/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "6D4F7A6C-5C9B-ED11-82CA-F365D7555AC1", name: "Jacob Clary", username: "jacob.clary@concretesupplyco.com", truckastRole: "ACP&UPSTATE", lastAccess: "07/23/2026", truckast: true, rollout: true, publish: false, projects: false, order: true, admin: false, analytics: true },
  { id: "3C281FAE-F1ED-EE11-82CA-F365D7555AC1", name: "Manny Acevedo", username: "manuel.acevedo@concretesupplyco.com", truckastRole: "ACP&UPSTATE", lastAccess: "07/13/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "45730710-F09A-EC11-82C9-22000A29EF36", name: "Shanita Speaks", username: "shanita.speaks@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/22/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "DFEB1073-92CB-EC11-82C9-22000A29EF36", name: "Cameron Parker", username: "cameron.parker@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/20/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "E5E786D0-C15B-EC11-82C9-22000A29EF36", name: "Jack Jones", username: "jjones@carolinareadymixinc.com", truckastRole: "CAROLINA READY MIX", lastAccess: "07/21/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "BD37A16F-8D69-E811-80F9-22000B772084", name: "Gary Kilker", username: "gkilker@carolinareadymixinc.com", truckastRole: "CAROLINA READY MIX", lastAccess: "07/20/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "43E42E92-5C4A-E511-80F2-22000B39E0BB", name: "Keith Mintz", username: "keith.mintz@concretesupplyco.com", truckastRole: "ADMIN", lastAccess: "07/22/2026", truckast: true, rollout: true, publish: false, projects: true, order: true, admin: true, analytics: true },
  { id: "E659103C-5828-E511-80F2-22000B39E0BB", name: "CSCDemo User", username: "cscuser@truckast.com", truckastRole: "ADMIN", lastAccess: "07/22/2026", truckast: true, rollout: true, publish: true, projects: true, order: true, admin: true, analytics: true },
  { id: "C4D3F283-0096-E611-80F8-22000B772084", name: "Shaun Knight", username: "shaun.knight@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/18/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "C9E46BBD-E052-E811-80F9-22000B772084", name: "Jim Roebuck", username: "jim.roebuck@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/21/2026", truckast: true, rollout: false, publish: false, projects: true, order: true, admin: false, analytics: true },
  { id: "785B7BB1-44B7-EB11-82C9-22000A29EF36", name: "Sean VanDyke", username: "sean.vandyke@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/19/2026", truckast: true, rollout: false, publish: false, projects: false, order: false, admin: false, analytics: false },
  { id: "1308831B-DFEE-EA11-82C8-22000AA7BA04", name: "Mark Armstrong", username: "mark.armstrong@concretesupplyco.com", truckastRole: "UPSTATE", lastAccess: "07/20/2026", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
  { id: "4F633248-2E5D-E911-80F9-22000B772084", name: "Mike Cline", username: "mike.cline@concretesupplyco.com", truckastRole: "CHARLOTTE", lastAccess: "07/22/2026", truckast: true, rollout: true, publish: false, projects: true, order: true, admin: false, analytics: true },
  { id: "634B103A-24E1-E911-82C8-22000AA7BA04", name: "Mike Valentine", username: "mike.valentine@concretesupplyco.com", truckastRole: "UPSTATE", lastAccess: "07/21/2026", truckast: true, rollout: false, publish: false, projects: false, order: true, admin: false, analytics: false },
];

export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        contractorUsers: CONTRACTOR_USERS,
        producerUsers: PRODUCER_USERS,
        contractorTotal: CONTRACTOR_USERS.length,
        producerTotal: PRODUCER_USERS.length,
      },
    });
  } catch (error) {
    console.error("Error fetching user dashboard:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user dashboard" },
      { status: 500 }
    );
  }
}
