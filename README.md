# truckast-d3-orders

D3 (Dolese / TRUCKAST) order-tracking drill-down — a faithful, **responsive** rebuild of the
live D3 mobile screens, reading **live data** from the same Supabase database as the main app.

## Drill-down flow

1. **Market Summary** (`/`) — "Dolese Orders" with a date selector, invite / order tiles, the fuel
   surcharge banner, and the green **DOLESE — used / total CY (Tot / Act / Can)** business-unit tile.
   → click it to open the day's orders.
2. **Orders** (`/orders`) — every order for the selected day as a folded-corner tile, color-coded by
   status (IN PROCESS · PRE-POUR · COMPLETED · CANCELLED), with search. → click an order.
3. **Order detail** (`/orders/[orderId]`) — status, stat tiles (Next Truck, Pour Finish, Trucks,
   Ordered, Ticketed, On Job), weather, and a Pour Speed chart.

## Data mapping

Server actions in `src/actions/orderActions.ts` query the live tables:

- `getDoleseSummary(date)` — aggregates `orders` + `order_products` (CY mix products): used/total CY,
  total/active/cancelled counts.
- `getDoleseOrders(date)` — orders for a day with derived status (cancelled / ticketed → in-process /
  status 4 → completed / else pre-pour) and ordered/ticketed CY.
- `getDoleseOrderDetail(orderId)` — single order + `tickets` aggregation (on-job CY, truck count,
  cumulative pour series, pour finish) and weather.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL + service role key
npm run dev                  # http://localhost:3000
```

`.env.local` holds the Supabase **service role key** and is git-ignored — keep it server-side only.

## Stack

Next.js 16 (App Router) · React 19 · Tailwind v4 · `@supabase/supabase-js` · lucide-react.
Shared UI primitives live in `src/components/d3-ui.tsx`.
