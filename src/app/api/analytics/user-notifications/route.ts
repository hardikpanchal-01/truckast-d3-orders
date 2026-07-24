import { NextRequest, NextResponse } from "next/server";

interface UserSetting {
  id: string;
  notification: string;
  email: boolean;
  sms: boolean;
}

interface AssignedCustomer {
  name: string;
  accountNumber: string;
}

interface CustomerNotification {
  date: string;
  orderNumber: string;
  customer: string;
  topic: string;
  sms: string;
  subject: string;
  email: string;
  sent: string;
}

interface QueuedNotification {
  dateAndTime: string;
  date: string;
  orderNumber: string;
  customer: string;
  topic: string;
  sms: string;
  subject: string;
  email: string;
  isSent: string;
  retryCount: number;
  sent: string;
}

interface ServerSentNotification {
  recipients: string;
  copyRecipients: string;
  blindCopyRecipients: string;
  subject: string;
  sentDate: string;
}

// Default notification settings
const DEFAULT_SETTINGS: UserSetting[] = [
  { id: "53FE7F06-2651-E111-84F4-0022190823E9", notification: "New Order", email: false, sms: true },
  { id: "0AF6693E-0C56-E311-9433-22000A98AC24", notification: "Plus Load", email: false, sms: true },
  { id: "58A16075-B461-E611-80F7-22000B772084", notification: "PSI >= 5000", email: true, sms: false },
  { id: "5679777F-058B-E111-9378-9EF3ACB14DA6", notification: "Late Truck", email: false, sms: true },
  { id: "941CCCD8-5D8E-E111-9378-9EF3ACB14DA6", notification: "First Truck", email: false, sms: true },
  { id: "8BA22422-678E-E111-9378-9EF3ACB14DA6", notification: "Last Truck", email: false, sms: true },
  { id: "4983F9BB-2F8F-E111-9378-9EF3ACB14DA6", notification: "Updated Order", email: false, sms: true },
  { id: "41CED1C7-308F-E111-9378-9EF3ACB14DA6", notification: "Will Call Order Reminder", email: false, sms: true },
  { id: "F378E6DE-8146-E311-8466-A7697EBE67DC", notification: "Order Request Accepted\\Rejected", email: true, sms: false },
  { id: "CBF6A0E0-3301-E311-9962-B5F293CD4A97", notification: "New Post", email: true, sms: true },
  { id: "86A9BBF2-3301-E311-9962-B5F293CD4A97", notification: "New Comment", email: true, sms: true },
  { id: "2DE2DCC5-C685-E811-80B5-D4BED9EDBE7F", notification: "First Truck Is Late", email: false, sms: true },
  { id: "A8CB697E-DC47-EA11-80C7-D4BED9EDBE7F", notification: "Next day Order", email: false, sms: true },
  { id: "CC8D287F-1D89-EA11-80C8-D4BED9EDBE7F", notification: "Mobile Ticket - Rejected", email: false, sms: true },
  { id: "D0995800-7D96-EA11-80CA-D4BED9EDBE7F", notification: "Mobile Ticket - Accepted", email: false, sms: true },
  { id: "53E6C914-7D96-EA11-80CA-D4BED9EDBE7F", notification: "Mobile Ticket Summary", email: false, sms: true },
  { id: "60CD5C21-499F-EA11-80CA-D4BED9EDBE7F", notification: "Mobile Ticket - Feedback", email: false, sms: true },
  { id: "28CC89D8-0885-E211-9178-F31FE83B2753", notification: "New Order Request", email: true, sms: false },
];

const CUSTOMER_NAMES = [
  "ACE CONCRETE CONSTRUCTION",
  "BAKER BUILDERS INC",
  "CAROLINA CONCRETE LLC",
  "DELTA PAVING COMPANY",
  "EASTERN CONTRACTORS",
  "FIRST CLASS CONCRETE",
  "GRANITE CONSTRUCTION",
  "HARBOR BUILDERS",
  "IDEAL CONCRETE WORKS",
  "JACKSON CONSTRUCTION",
];

const TOPICS = [
  "New Order",
  "Plus Load",
  "Late Truck",
  "First Truck",
  "Last Truck",
  "Updated Order",
  "Order Request",
  "Mobile Ticket",
  "New Post",
  "New Comment",
];

function generateMockData(userId: string, startDate: string, endDate: string) {
  // Generate user settings (randomly enable some)
  const userSettings: UserSetting[] = DEFAULT_SETTINGS.map(setting => ({
    ...setting,
    email: setting.email && Math.random() > 0.3,
    sms: setting.sms && Math.random() > 0.3,
  }));

  // Generate assigned customers (3-8 customers)
  const numCustomers = Math.floor(Math.random() * 6) + 3;
  const assignedCustomers: AssignedCustomer[] = [];
  for (let i = 0; i < numCustomers; i++) {
    assignedCustomers.push({
      name: CUSTOMER_NAMES[i % CUSTOMER_NAMES.length],
      accountNumber: (10000 + i * 111).toString(),
    });
  }

  // Generate customer notifications (5-15 notifications)
  const numNotifications = Math.floor(Math.random() * 11) + 5;
  const customerNotifications: CustomerNotification[] = [];
  for (let i = 0; i < numNotifications; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    const hasSms = Math.random() > 0.5;
    const hasEmail = Math.random() > 0.5;
    customerNotifications.push({
      date: date.toLocaleDateString(),
      orderNumber: "ORD-" + (100000 + Math.floor(Math.random() * 9000)),
      customer: CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)],
      topic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
      sms: hasSms ? "Yes" : "",
      subject: "Order Notification",
      email: hasEmail ? "Yes" : "",
      sent: Math.random() > 0.2 ? "Yes" : "No",
    });
  }

  // Generate queued notifications (0-5 notifications)
  const numQueued = Math.floor(Math.random() * 6);
  const queuedNotifications: QueuedNotification[] = [];
  for (let i = 0; i < numQueued; i++) {
    const date = new Date();
    date.setHours(date.getHours() - Math.floor(Math.random() * 24));
    const hasSms = Math.random() > 0.5;
    const hasEmail = Math.random() > 0.5;
    queuedNotifications.push({
      dateAndTime: date.toLocaleString(),
      date: date.toLocaleDateString(),
      orderNumber: "ORD-" + (100000 + Math.floor(Math.random() * 9000)),
      customer: CUSTOMER_NAMES[Math.floor(Math.random() * CUSTOMER_NAMES.length)],
      topic: TOPICS[Math.floor(Math.random() * TOPICS.length)],
      sms: hasSms ? "Yes" : "",
      subject: "Pending Notification",
      email: hasEmail ? "Yes" : "",
      isSent: "No",
      retryCount: Math.floor(Math.random() * 3),
      sent: "Pending",
    });
  }

  // Generate server sent notifications (5-12 notifications)
  const numServerSent = Math.floor(Math.random() * 8) + 5;
  const serverSentNotifications: ServerSentNotification[] = [];
  for (let i = 0; i < numServerSent; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 7));
    serverSentNotifications.push({
      recipients: `user${Math.floor(Math.random() * 100)}@concretesupply.com`,
      copyRecipients: Math.random() > 0.7 ? "manager@concretesupply.com" : "",
      blindCopyRecipients: "",
      subject: "Order Update - " + TOPICS[Math.floor(Math.random() * TOPICS.length)],
      sentDate: date.toLocaleString(),
    });
  }

  return {
    userSettings,
    assignedCustomers,
    customerNotifications,
    queuedNotifications,
    serverSentNotifications,
  };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get("userId") || "";

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startDate =
      searchParams.get("startDate") || today.toISOString().split("T")[0];
    const endDate =
      searchParams.get("endDate") || tomorrow.toISOString().split("T")[0];

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: "No User ID provided",
      });
    }

    const data = generateMockData(userId, startDate, endDate);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error fetching user notifications:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch user notifications" },
      { status: 500 }
    );
  }
}
