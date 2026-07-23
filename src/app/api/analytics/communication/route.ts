import { NextRequest, NextResponse } from "next/server";
import { getSelectedTenant } from "@/actions/tenantActions";

const CONTRACTOR_NAMES = [
  "Jason Cabaniss",
  "Anderlin Rodriguez",
  "Dillon Turman",
  "Ha Kim",
  "Jesse Fanton",
  "Tyler Long",
  "Mikel Riley",
  "Gavin Ange",
  "Kenny Wang",
  "John Kirk",
  "Blaine Snipes",
  "Dylan Lira",
  "Chris Lombardi",
  "Hector Lopez",
  "Jesse Reyes",
  "William Rivas",
  "Curtis Mclaughlin",
  "Henry Guardado",
  "Lucas Zajdel",
  "Nathaniel Petrie",
];

const PRODUCER_NAMES = [
  "George Nash",
  "Terry Williams",
  "Erik Snyder",
  "Jonathan Parris",
  "Damian Difilippo",
  "Drew Stankwytch",
  "Landon Taylor",
  "Steve Podraza",
  "Adam Harris",
  "Jim Tsumas",
];

const REQUESTOR_NAMES = [
  "Brian Funk",
  "Anderlin Rodriguez",
  "Chris Lombardi",
  "Darryl Jenkins",
  "Tate Osborne",
  "Joel Sanchez",
  "Geno Bernhard",
  "Jimmy Montgomery",
  "Alejandra Ardila",
  "Cory Crumbaugh",
];

interface UserMessage {
  userName: string;
  userRole: string;
  totalMessages: number;
  activeDays: number;
  avgDaysCalc: string;
  avgPerDay: number;
  orderMessages: number;
  acceptReject: number;
  requestMessages: number;
}

function generateMockData(
  avgDays: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const daysDiff = Math.ceil(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  ) + 1;

  // Calculate avg days divisor
  const avgDaysDivisor = avgDays === "ActiveDays" ? daysDiff : parseInt(avgDays) || 5;

  // Social Stream Messages
  const totalStreamMessages = 3500 + Math.floor(Math.random() * 500);
  const totalOrderMessages = totalStreamMessages - 100 - Math.floor(Math.random() * 50);
  const totalRequestMessages = 100 + Math.floor(Math.random() * 50);

  // Order Requests
  const totalRequests = 180 + Math.floor(Math.random() * 40);
  const accepted = Math.floor(totalRequests * 0.65);
  const rejected = Math.floor(totalRequests * 0.33);
  const nonResponsive = totalRequests - accepted - rejected;

  // Generate daily messages data
  const categories: string[] = [];
  const orderMessages: number[] = [];
  const orderRequestAcceptReject: number[] = [];
  const orderRequestMessages: number[] = [];

  for (let i = 0; i < daysDiff; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const dateStr = (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
                    date.getDate().toString().padStart(2, '0') + '/' +
                    date.getFullYear();
    categories.push(dateStr);

    // Weekends have less activity
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      orderMessages.push(Math.floor(Math.random() * 10));
      orderRequestAcceptReject.push(0);
      orderRequestMessages.push(0);
    } else {
      orderMessages.push(150 + Math.floor(Math.random() * 150));
      orderRequestAcceptReject.push(5 + Math.floor(Math.random() * 20));
      orderRequestMessages.push(Math.floor(Math.random() * 15));
    }
  }

  // Top Contractors
  const topContractorNames = CONTRACTOR_NAMES.slice(0, 10);
  const topContractorOrderMessages = [184, 146, 113, 111, 111, 89, 87, 76, 65, 43];
  const topContractorRequestMessages = [0, 6, 0, 0, 0, 0, 0, 0, 0, 0];

  // Top Requestors
  const topRequestorNames = REQUESTOR_NAMES.slice(0, 10);
  const topRequestorCounts = [36, 21, 14, 14, 12, 10, 9, 7, 6, 5];

  // Top Producers
  const topProducerNames = PRODUCER_NAMES.slice(0, 10);
  const topProducerOrderMessages = [1362, 239, 129, 50, 8, 3, 3, 3, 2, 2];
  const topProducerAcceptReject = [173, 2, 3, 1, 0, 0, 0, 0, 0, 0];
  const topProducerRequestMessages = [85, 3, 1, 1, 0, 0, 0, 0, 0, 0];

  // User Messages Table
  const userMessages: UserMessage[] = [];

  // Add producers
  PRODUCER_NAMES.forEach((name, idx) => {
    const orderMsgs = Math.max(0, 1500 - idx * 150 + Math.floor(Math.random() * 50));
    const acceptRejectCount = Math.max(0, Math.floor(orderMsgs * 0.1));
    const requestMsgs = Math.max(0, Math.floor(acceptRejectCount * 0.5));
    const total = orderMsgs + acceptRejectCount + requestMsgs;
    const activeDays = daysDiff;
    const calcDays = parseInt(avgDays) || 5;
    const avgPerDay = total / calcDays;

    userMessages.push({
      userName: name,
      userRole: "Producer",
      totalMessages: total,
      activeDays: activeDays,
      avgDaysCalc: avgDays === "ActiveDays" ? "ActiveDays" : avgDays,
      avgPerDay: avgPerDay,
      orderMessages: orderMsgs,
      acceptReject: acceptRejectCount,
      requestMessages: requestMsgs,
    });
  });

  // Add contractors
  CONTRACTOR_NAMES.forEach((name, idx) => {
    const orderMsgs = Math.max(0, 200 - idx * 10 + Math.floor(Math.random() * 20));
    const requestMsgs = Math.floor(Math.random() * 8);
    const total = orderMsgs + requestMsgs;
    const activeDays = Math.max(1, daysDiff - Math.floor(Math.random() * 5));
    const avgPerDay = total / activeDays;

    userMessages.push({
      userName: name,
      userRole: "Contractor",
      totalMessages: total,
      activeDays: activeDays,
      avgDaysCalc: "ActiveDays",
      avgPerDay: avgPerDay,
      orderMessages: orderMsgs,
      acceptReject: 0,
      requestMessages: requestMsgs,
    });
  });

  // Sort by total messages descending
  userMessages.sort((a, b) => b.totalMessages - a.totalMessages);

  return {
    socialStream: {
      totalMessages: totalStreamMessages,
      avgMessages: totalStreamMessages / avgDaysDivisor,
      totalOrderMessages: totalOrderMessages,
      avgOrderMessages: totalOrderMessages / avgDaysDivisor,
      totalRequestMessages: totalRequestMessages,
      avgRequestMessages: totalRequestMessages / avgDaysDivisor,
    },
    orderRequests: {
      total: totalRequests,
      avgDaily: totalRequests / avgDaysDivisor,
      accepted: accepted,
      avgAccepted: accepted / avgDaysDivisor,
      rejected: rejected,
      avgRejected: rejected / avgDaysDivisor,
      nonResponsive: nonResponsive,
      avgNonResponsive: nonResponsive / avgDaysDivisor,
    },
    dailyMessages: {
      categories: categories,
      orderMessages: orderMessages,
      orderRequestAcceptReject: orderRequestAcceptReject,
      orderRequestMessages: orderRequestMessages,
    },
    topContractors: {
      names: topContractorNames,
      orderMessages: topContractorOrderMessages,
      requestMessages: topContractorRequestMessages,
    },
    topRequestors: {
      names: topRequestorNames,
      requests: topRequestorCounts,
    },
    topProducers: {
      names: topProducerNames,
      orderMessages: topProducerOrderMessages,
      acceptReject: topProducerAcceptReject,
      requestMessages: topProducerRequestMessages,
    },
    userMessages: userMessages,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const avgDays = searchParams.get("avgDays") || "5";

    const today = new Date();
    const threeWeeksAgo = new Date(today);
    threeWeeksAgo.setDate(threeWeeksAgo.getDate() - 21);

    const startDate =
      searchParams.get("startDate") || threeWeeksAgo.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || today.toISOString().split("T")[0];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const tenant = await getSelectedTenant();

    const data = generateMockData(avgDays, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching communication analytics data:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch communication analytics data" },
      { status: 500 }
    );
  }
}
