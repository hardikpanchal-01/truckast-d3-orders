import { NextRequest, NextResponse } from 'next/server';

// Sample data arrays for generating dynamic data
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
  'RAL - JOHNSON AND JOHNSON',
  'RAL - DOWNTOWN TOWER',
  'UPS - WAREHOUSE EXPANSION',
  'N/A'
];

const producerUsers = [
  'Mike Thompson', 'Sarah Johnson', 'David Wilson', 'Emily Davis', 'Chris Brown',
  'Amanda Martinez', 'Robert Taylor', 'Jennifer White', 'Michael Lee', 'Jessica Garcia',
  'Daniel Anderson', 'Ashley Thomas', 'Matthew Jackson', 'Nicole Harris', 'Joshua Martin',
  'Stephanie Robinson', 'Andrew Clark', 'Michelle Lewis', 'Ryan Walker', 'Kimberly Hall'
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
  return String(201000 + index);
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
    const producerViewedData: [number, number][] = [];

    const currentDate = new Date(start);
    while (currentDate <= end) {
      const timestamp = currentDate.getTime();
      const orderedVolume = Math.random() * 35000 + 5000;
      const viewedVolume = orderedVolume * (0.20 + Math.random() * 0.15); // Producer views slightly higher

      orderedVolumeData.push([timestamp, Math.round(orderedVolume * 100) / 100]);
      producerViewedData.push([timestamp, Math.round(viewedVolume * 100) / 100]);

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
      name: 'Producer Viewed Order Volume',
      connectNulls: true,
      data: producerViewedData
    });

    // Calculate totals
    const totalOrderedVolume = orderedVolumeData.reduce((sum, d) => sum + d[1], 0);
    const totalViewedVolume = producerViewedData.reduce((sum, d) => sum + d[1], 0);

    // Generate ticketed volume chart data
    const ticketedChartSeries = [];
    const ticketedVolumeData: [number, number][] = [];
    const producerViewedTicketedData: [number, number][] = [];

    const ticketDate = new Date(start);
    while (ticketDate <= end) {
      const timestamp = ticketDate.getTime();
      const ticketedVolume = Math.random() * 5000 + 1000;
      const viewedTicketedVolume = ticketedVolume * (0.12 + Math.random() * 0.08);

      ticketedVolumeData.push([timestamp, Math.round(ticketedVolume * 100) / 100]);
      producerViewedTicketedData.push([timestamp, Math.round(viewedTicketedVolume * 100) / 100]);

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
      name: 'Producer Viewed Ticketed Volume',
      connectNulls: true,
      data: producerViewedTicketedData
    });

    // Generate dynamic order views based on date range
    const orderViews = [];
    const numOrders = Math.min(daysDiff * 10, 120); // Slightly more producer views

    for (let i = 0; i < numOrders; i++) {
      const randomDayOffset = Math.floor(Math.random() * daysDiff);
      const orderDate = new Date(start);
      orderDate.setDate(orderDate.getDate() + randomDayOffset);

      orderViews.push({
        scheduledDate: formatDate(orderDate),
        orderNumber: generateOrderNumber(i),
        viewedCY: String(Math.round((Math.random() * 120 + 10) * 100) / 100),
        status: getRandomItem(statuses),
        firstUserToView: getRandomItem(producerUsers),
        viewDate: formatDate(orderDate),
        otherViewers: String(Math.floor(Math.random() * 6)),
        project: getRandomItem(projects),
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
    const numTickets = Math.min(daysDiff * 6, 90);

    for (let i = 0; i < numTickets; i++) {
      const randomDayOffset = Math.floor(Math.random() * daysDiff);
      const ticketDateObj = new Date(start);
      ticketDateObj.setDate(ticketDateObj.getDate() + randomDayOffset);

      const orderNum = generateOrderNumber(Math.floor(Math.random() * 60));

      ticketViews.push({
        scheduledDate: formatDate(ticketDateObj),
        orderNumber: orderNum,
        ticketNumber: generateTicketNumber(orderNum, i),
        viewedCY: String(Math.round((Math.random() * 18 + 3) * 100) / 100),
        status: getRandomItem(statuses),
        firstUserToView: getRandomItem(producerUsers),
        viewDate: formatDate(ticketDateObj),
        otherViewers: String(Math.floor(Math.random() * 4)),
        project: getRandomItem(projects),
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
    const producerOrdersCount = Math.round(ordersCount * 0.20); // ~20% producer views
    const producerTicketsCount = Math.round(ticketViews.length * 1.7);
    const producerTicketsVolume = ticketViews.reduce((sum, t) => sum + parseFloat(t.viewedCY), 0);

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          ordersCount: ordersCount,
          ordersVolume: totalOrderedVolume,
          producerOrdersCount: producerOrdersCount,
          producerOrdersVolume: totalViewedVolume,
          producerTicketsCount: producerTicketsCount,
          producerTicketsVolume: Math.round(producerTicketsVolume * 100) / 100
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
    console.error('Error in producer-viewed API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch producer viewed data' },
      { status: 500 }
    );
  }
}
