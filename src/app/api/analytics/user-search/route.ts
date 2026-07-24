import { NextRequest, NextResponse } from "next/server";

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
}

// Mock user data matching the D3 system
const MOCK_USERS: User[] = [
  { id: "45730710-F09A-EC11-82C9-22000A29EF36", name: "SHANITA SPEAKS", email: "shanita.speaks@concretesupplyco.com", phone: "704-555-0101" },
  { id: "DFEB1073-92CB-EC11-82C9-22000A29EF36", name: "CAMERON PARKER", email: "cameron.parker@concretesupplyco.com", phone: "704-555-0102" },
  { id: "421E43E0-F530-E811-80F8-22000B772084", name: "MICHAEL WALKER", email: "michael@raywalkertrucking.com", phone: "704-555-0103" },
  { id: "EF9E40A9-5C80-EB11-82C9-22000A29EF36", name: "MATT CATO", email: "mbcato@dawkinsonsite.com", phone: "704-555-0104" },
  { id: "68073388-7214-F011-82CB-DB25CFADDFDF", name: "RICHARD KAUFFMAN", email: "richard.kauffman@concretesupplyco.com", phone: "704-555-0105" },
  { id: "EAFD44EA-B3A3-EB11-82C9-22000A29EF36", name: "KYLE RICE", email: "spartanburgacp@american-concrete.com", phone: "704-555-0106" },
  { id: "E5E786D0-C15B-EC11-82C9-22000A29EF36", name: "JACK JONES", email: "jjones@carolinareadymixinc.com", phone: "704-555-0107" },
  { id: "BD37A16F-8D69-E811-80F9-22000B772084", name: "GARY KILKER", email: "gkilker@carolinareadymixinc.com", phone: "704-555-0108" },
  { id: "0F2DF11C-2773-E811-80F9-22000B772084", name: "STANLEY BUCKNER", email: "sbuckner@carolinareadymixinc.com", phone: "704-555-0109" },
  { id: "81C4D14F-2773-E811-80F9-22000B772084", name: "MARK DAVIS", email: "mdavis@carolinareadymixinc.com", phone: "704-555-0110" },
  { id: "7E5D4BA3-DD26-F111-82CC-9F6F49760254", name: "JACKIE MILLS", email: "jmills@carolinareadymixinc.com", phone: "704-555-0111" },
  { id: "1EB2B5EB-E5C9-EF11-82CB-DB25CFADDFDF", name: "GABE KIRKPATRICK", email: "gkirkpatrick@carolinareadymixinc.com", phone: "704-555-0112" },
  { id: "E4BDBA55-96CA-EA11-82C8-22000AA7BA04", name: "CHARLESTON MARKET", email: "charleston@concretesupplyco.com", phone: "704-555-0113" },
  { id: "9CB92E86-F659-ED11-82CA-F365D7555AC1", name: "WAYLON WOODCOCK", email: "waylon.woodcock@concretesupplyco.com", phone: "704-555-0114" },
  { id: "3AF47E2E-0B3C-EC11-82C9-22000A29EF36", name: "T.J. ROBINETTE", email: "kingsmtn@concretesupplyco.com", phone: "704-555-0115" },
  { id: "35144805-11EC-EC11-82C9-22000A29EF36", name: "RICK BIGHAM", email: "rick.bigham@concretesupplyco.com", phone: "704-555-0116" },
  { id: "C4583C5A-1D36-EA11-82C8-22000AA7BA04", name: "ERIK SNYDER", email: "erik.snyder@concretesupplyco.com", phone: "704-555-0117" },
  { id: "C9E46BBD-E052-E811-80F9-22000B772084", name: "JIM ROEBUCK", email: "jim.roebuck@concretesupplyco.com", phone: "704-555-0118" },
  { id: "5B19328F-FA6A-EB11-82C8-22000AA7BA04", name: "CURRY DAWKING", email: "curry@dawkinsconcrete.com", phone: "704-555-0119" },
  { id: "D393E9F9-3A0C-F111-82CC-9F6F49760254", name: "CINDY STEVENSON", email: "cindy@dawkinsconcrete.com", phone: "704-555-0120" },
  { id: "63B74B0D-3B0C-F111-82CC-9F6F49760254", name: "WAYNE GARNER", email: "wayne@dawkinsconcrete.com", phone: "704-555-0121" },
  { id: "785B7BB1-44B7-EB11-82C9-22000A29EF36", name: "SEAN VANDYKE", email: "sean.vandyke@concretesupplyco.com", phone: "704-555-0122" },
  { id: "F1603151-5742-EC11-82C9-22000A29EF36", name: "NOKIA GOINS", email: "nokia.goins@concretesupplyco.com", phone: "704-555-0123" },
  { id: "1308831B-DFEE-EA11-82C8-22000AA7BA04", name: "MARK ARMSTRONG", email: "mark.armstrong@concretesupplyco.com", phone: "704-555-0124" },
  { id: "4F633248-2E5D-E911-80F9-22000B772084", name: "MIKE CLINE", email: "mike.cline@concretesupplyco.com", phone: "704-555-0125" },
  { id: "214F54D2-E1ED-EF11-82CB-DB25CFADDFDF", name: "DREW STANKWYTCH", email: "drew.stankwytch@concretesupplyco.com", phone: "704-555-0126" },
  { id: "AEFD42F7-E1ED-EF11-82CB-DB25CFADDFDF", name: "TIM KINDER", email: "tim.kinder@concretesupplyco.com", phone: "704-555-0127" },
  { id: "4134E5AC-26DE-ED11-82CA-F365D7555AC1", name: "NAKOA GOINS", email: "nakoa.goins@concretesupplyco.com", phone: "704-555-0128" },
  { id: "927C5C6E-1D62-EE11-82CA-F365D7555AC1", name: "ANDRE SHANKS", email: "andre.shanks@concretesupplyco.com", phone: "704-555-0129" },
  { id: "15DA80C3-E3EA-EF11-82CB-DB25CFADDFDF", name: "RAHAB KAGURU", email: "rahab.kaguru@concretesupplyco.com", phone: "704-555-0130" },
  { id: "8772ADA9-18D6-EC11-82C9-22000A29EF36", name: "KASEY TURNER", email: "kasey.turner@concretesupplyco.com", phone: "704-555-0131" },
  { id: "634B103A-24E1-E911-82C8-22000AA7BA04", name: "MIKE VALENTINE", email: "mike.valentine@concretesupplyco.com", phone: "704-555-0132" },
  { id: "8BAFEC43-7AC7-EA11-82C8-22000AA7BA04", name: "RICKY MILLER", email: "ricky.miller@concretesupplyco.com", phone: "704-555-0133" },
  { id: "E659103C-5828-E511-80F2-22000B39E0BB", name: "CSCDEMO USER", email: "cscuser@truckast.com", phone: "704-555-0134" },
  { id: "43E42E92-5C4A-E511-80F2-22000B39E0BB", name: "KEITH MINTZ", email: "keith.mintz@concretesupplyco.com", phone: "704-555-0135" },
  { id: "C4D3F283-0096-E611-80F8-22000B772084", name: "SHAUN KNIGHT", email: "shaun.knight@concretesupplyco.com", phone: "704-555-0136" },
  { id: "5F3354B4-0A32-E811-80F8-22000B772084", name: "JOHN EVANS", email: "johnevansreynolds@outlook.com", phone: "704-555-0137" },
  { id: "51C5D915-C871-E911-80F9-22000B772084", name: "NICK NICHOLSON", email: "nick.nicholson@concretesupplyco.com", phone: "704-555-0138" },
  { id: "33F706FE-EA58-F111-82CC-9F6F49760254", name: "MARK THOMAS", email: "mark.thomas@concretesupplyco.com", phone: "704-555-0139" },
  { id: "03ABA722-EB58-F111-82CC-9F6F49760254", name: "NICK GRIZZELL", email: "nicholas.grizzell@concretesupplyco.com", phone: "704-555-0140" },
  { id: "C815618F-5F59-F111-82CC-9F6F49760254", name: "DERRICK HAWKS", email: "derrick.hawks@centralcarolinaconcrete.com", phone: "704-555-0141" },
];

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.toLowerCase() || "";

    let filteredUsers = MOCK_USERS;

    if (search) {
      filteredUsers = MOCK_USERS.filter(
        (user) =>
          user.name.toLowerCase().includes(search) ||
          user.email.toLowerCase().includes(search) ||
          user.phone.includes(search)
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        users: filteredUsers,
        total: filteredUsers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
