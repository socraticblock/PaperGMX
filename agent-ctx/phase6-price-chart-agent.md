# Phase 6: Real-time Price Chart Component

## Task ID
phase6-price-chart

## Agent
price-chart-agent

## Summary
Implemented a real-time price chart component using `lightweight-charts` v5 (TradingView) that replaces the placeholder on the trade page.

## Files Created
- `src/components/trade/PriceChart.tsx` — New React component with lightweight-charts v5 line chart

## Files Modified
- `src/app/trade/[market]/page.tsx` — Replaced chart placeholder with PriceChart component, removed unused imports (`MARKETS`, `formatPrice`, `marketConfig`, `currentPrice`)

## Key Implementation Details

### PriceChart.tsx
- Uses `createChart()` from lightweight-charts v5 with `LineSeries` definition
- Accepts `market: MarketSlug` and `priceData: PriceData | undefined` props
- Accumulates price history in a ref buffer (last 200 data points)
- Updates chart series via `series.update()` on each price tick (every ~3 seconds)
- Uses `useRef` for chart instance and series to avoid re-creation
- Dark GMX-style theme: background `#0c0e14`, text `#8a8f98`, grid `#1e2230`, line `#418cf5`
- Responsive via ResizeObserver that watches container dimensions
- Minimum height 500px
- Proper cleanup: `chart.remove()` on unmount, ResizeObserver disconnected
- Wrapped in `memo` for performance
- Uses `UTCTimestamp` branded type for time values (lightweight-charts requirement)
- Handles duplicate timestamps (enforces strictly increasing time)
- Shows Oracle Min/Max in chart header
- Live indicator pulse dot using `animate-pulse-glow`
- LastPriceAnimation set to `OnDataUpdate` for visual feedback on new prices

### Trade page integration
- Replaced the 28-line placeholder block with `<PriceChart market={slug} priceData={priceData} />`
- Maintained the sticky positioning and two-column layout
- Removed now-unused imports and variables

## Build Status
- `next build` passes with no TypeScript errors
- `bun run lint` shows no new errors in changed files (pre-existing errors in other files remain)
