import { NextRequest, NextResponse } from 'next/server';

// Sample data arrays for generating dynamic data
const contractors = [
  'LITHKO CONTRACTING INC',
  'BLYTHE DEVELOPMENT CO',
  'CAROLINA CURB AND GUTTER, LLC',
  'KRETE WORKS CONCRETE CONSTRUCTION, LLC',
  "RAUL'S CONCRETE",
  'REEVES YOUNG, LLC',
  'RIVERSIDE CONCRETE, INC',
  'CITY OF ROCK HILL',
  'BENTON CONCRETE & UTILITIES LLC',
  'DOGGETT CONCRETE CONSTRUCTION',
  'DOT CONSTRUCTION',
  'WAYNE BROTHERS, INC'
];

const projects = [
  'CLT - QTS DATA CENTER 1',
  'CLT - QTS DATA CENTER 3',
  'CLT - #24001 SCDOT HWY 72',
  'CLT - #26008 HERALD REDEVELOPMENT',
  'CLT - VARIOUS',
  'CLT - MANCHESTER CREEK WWTP',
  'CLT - DELIVERED',
  'CLT - SCDOT CHESTER CO. 1268970',
  'CLT - 1111 S TRYON TOWER 2',
  'CLT - PANORAMA FALCON',
  'CLT - RESIDENTIAL VARIOUS',
  'CHS-Boeing 88 - 48',
  'N/A'
];

const users = [
  'Alex Ratzloff', 'Jason Cabaniss', 'Henry Guardado', 'Raul Crue', 'Gavin Ange',
  'Jesse Fanton', 'Luis Picaso', 'Martin Gonzales', 'Matt Frizzell', 'Ryan Lewis',
  'James Kossakowski', 'Anderlin Rodriguez', 'Kenny Williams', 'Brent Comer',
  'Seth Skipper', 'Eric Ramsey', 'Quin McHale', 'Juan Melchor', 'Tyler Long',
  'Logan Mauldin', 'Hunter Smith', 'Greg Loa', 'Korey White', 'Ha Kim', 'Sayon Lagadeau'
];

const businessUnits = ['CHARLOTTE', 'RALEIGH', 'UPSTATE', 'COLUMBIA', 'COASTAL', 'CENTRAL CAROLINA', 'SANDHILLS', 'CHARLESTON'];
const statuses = ['Complete', 'Cancelled', 'In Progress', 'Scheduled'];

function formatDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateOrderNumber(index: number): string {
  return String(101000 + index);
}

function generateTicketNumber(orderNum: string, index: number): string {
  return orderNum + String(index).padStart(3, '0');
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';
    const organization = searchParams.get('organization') || '22B7F5E2-0F3C-E311-8466-A7697EBE67DC';

    // Generate date range for chart
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    // Calculate number of days
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Generate chart data
    const chartSeries = [];
    const orderedVolumeData: [number, number][] = [];
    const contractorViewedData: [number, number][] = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const timestamp = currentDate.getTime();
      const orderedVolume = Math.random() * 35000 + 5000;
      const viewedVolume = orderedVolume * (0.15 + Math.random() * 0.1);

      orderedVolumeData.push([timestamp, Math.round(orderedVolume * 100) / 100]);
      contractorViewedData.push([timestamp, Math.round(viewedVolume * 100) / 100]);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    chartSeries.push({
      type: 'area',
      name: 'Ordered Volume',
      connectNulls: true,
      data: orderedVolumeData
    });

    chartSeries.push({
      type: 'area',
      name: 'Contractor Viewed Order Volume',
      connectNulls: true,
      data: contractorViewedData
    });

    // Calculate totals
    const totalOrderedVolume = orderedVolumeData.reduce((sum, d) => sum + d[1], 0);
    const totalViewedVolume = contractorViewedData.reduce((sum, d) => sum + d[1], 0);

    // Generate ticketed volume chart data
    const ticketedChartSeries = [];
    const ticketedVolumeData: [number, number][] = [];
    const contractorViewedTicketedData: [number, number][] = [];

    const ticketDate = new Date(start);
    while (ticketDate <= end) {
      const timestamp = ticketDate.getTime();
      const ticketedVolume = Math.random() * 5000 + 1000;
      const viewedTicketedVolume = ticketedVolume * (0.08 + Math.random() * 0.05);

      ticketedVolumeData.push([timestamp, Math.round(ticketedVolume * 100) / 100]);
      contractorViewedTicketedData.push([timestamp, Math.round(viewedTicketedVolume * 100) / 100]);

      ticketDate.setDate(ticketDate.getDate() + 1);
    }

    ticketedChartSeries.push({
      type: 'area',
      name: 'Ticketed Volume',
      connectNulls: true,
      data: ticketedVolumeData
    });

    ticketedChartSeries.push({
      type: 'area',
      name: 'Contractor Viewed Ticketed Volume',
      connectNulls: true,
      data: contractorViewedTicketedData
    });

    // Generate dynamic order views based on date range
    const orderViews = [];
    const numOrders = Math.min(daysDiff * 8, 100); // Generate more orders for longer date ranges

    for (let i = 0; i < numOrders; i++) {
      const randomDayOffset = Math.floor(Math.random() * daysDiff);
      const orderDate = new Date(start);
      orderDate.setDate(orderDate.getDate() + randomDayOffset);

      orderViews.push({
        scheduledDate: formatDate(orderDate),
        orderNumber: generateOrderNumber(i),
        viewedCY: String(Math.round((Math.random() * 100 + 5) * 100) / 100),
        status: getRandomItem(statuses),
        firstUserToView: getRandomItem(users),
        viewDate: formatDate(orderDate),
        otherViewers: String(Math.floor(Math.random() * 5)),
        project: getRandomItem(projects),
        contractorCompanies: getRandomItem(contractors),
        businessUnit: getRandomItem(businessUnits)
      });
    }

    // Sort by date
    orderViews.sort((a, b) => {
      const dateA = new Date(a.scheduledDate);
      const dateB = new Date(b.scheduledDate);
      return dateA.getTime() - dateB.getTime();
    });

    // Generate dynamic ticket views based on date range
    const ticketViews = [];
    const numTickets = Math.min(daysDiff * 5, 80); // Generate tickets for date range

    for (let i = 0; i < numTickets; i++) {
      const randomDayOffset = Math.floor(Math.random() * daysDiff);
      const ticketDateObj = new Date(start);
      ticketDateObj.setDate(ticketDateObj.getDate() + randomDayOffset);

      const orderNum = generateOrderNumber(Math.floor(Math.random() * 50));

      ticketViews.push({
        scheduledDate: formatDate(ticketDateObj),
        orderNumber: orderNum,
        ticketNumber: generateTicketNumber(orderNum, i),
        viewedCY: String(Math.round((Math.random() * 15 + 2) * 100) / 100),
        status: getRandomItem(statuses),
        firstUserToView: getRandomItem(users),
        viewDate: formatDate(ticketDateObj),
        otherViewers: String(Math.floor(Math.random() * 3)),
        project: getRandomItem(projects),
        contractorCompanies: getRandomItem(contractors),
        businessUnit: getRandomItem(businessUnits)
      });
    }

    // Sort by date
    ticketViews.sort((a, b) => {
      const dateA = new Date(a.scheduledDate);
      const dateB = new Date(b.scheduledDate);
      return dateA.getTime() - dateB.getTime();
    });

    // Calculate summary counts based on generated data
    const ordersCount = Math.round(800 * daysDiff + Math.random() * 200);
    const contractorOrdersCount = Math.round(ordersCount * 0.14);
    const contractorTicketsCount = Math.round(ticketViews.length * 1.5);
    const contractorTicketsVolume = ticketViews.reduce((sum, t) => sum + parseFloat(t.viewedCY), 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ordersCount: ordersCount,
          ordersVolume: totalOrderedVolume,
          contractorOrdersCount: contractorOrdersCount,
          contractorOrdersVolume: totalViewedVolume,
          contractorTicketsCount: contractorTicketsCount,
          contractorTicketsVolume: Math.round(contractorTicketsVolume * 100) / 100
        },
        chartData: {
          series: chartSeries
        },
        ticketedChartData: {
          series: ticketedChartSeries
        },
        orderViews: orderViews,
        ticketViews: ticketViews
      }
    });
  } catch (error) {
    console.error('Error in contractor-viewed API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contractor viewed data' },
      { status: 500 }
    );
  }
}
