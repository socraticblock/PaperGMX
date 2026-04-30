# PaperGMX — Implementation Roadmap

## Build Order: Perfect Each Phase Before Moving On

Every phase produces a **runnable, testable** application. We do NOT move to the next phase until the current one is polished and working perfectly. Each phase has a clear "Done" checklist.

---

## Phase 1: Project Foundation & Shell
**Goal:** A running Next.js app with dark theme, navigation shell, and GMX-style layout. No trading yet — just the skeleton.

### Tasks
| # | Task | Details |
|---|------|---------|
| 1.1 | Initialize Next.js 16 project | `npx create-next-app@latest` with TypeScript, TailwindCSS, App Router, src/ directory |
| 1.2 | Configure TailwindCSS dark theme | GMX color palette: bg #0a0a0f, card #1a1a2e, borders #2a2a3e, primary blue #418cf5, green #22c55e, red #ef4444 |
| 1.3 | Install core dependencies | `zustand` (state), `lightweight-charts` (charts), `@heroicons/react` (icons), `framer-motion` (animations) |
| 1.4 | Create layout shell | Header (logo + balance display + settings icon), main content area, no sidebar (single-page trading focus) |
| 1.5 | Create Header component | PaperGMX logo (left), fake USDC balance (center), Settings gear icon (right) |
| 1.6 | Create Settings panel (empty shell) | Slide-out panel from right, placeholder sections for: Balance, Tutorial, Trading Mode, About |
| 1.7 | Create Landing page | Hero text, balance selection ($10K / $100K / $1M / custom), Start Trading button |
| 1.8 | Create Zustand store (basic) | `usePaperStore` with: balance, isInitialized, tutorialEnabled, tradingMode |
| 1.9 | localStorage persistence | Zustand middleware to persist store to localStorage |
| 1.10 | Mobile responsive layout | GMX is desktop-first but must work on mobile; responsive header, stack layout on small screens |
| 1.11 | Push to GitHub | All code committed and pushed to PaperGMX repo |

### File Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout with dark theme
│   ├── page.tsx            # Landing page (balance selection)
│   └── globals.css         # TailwindCSS + GMX theme variables
├── components/
│   ├── Header.tsx          # Top bar with logo, balance, settings
│   ├── SettingsPanel.tsx   # Slide-out settings (shell)
│   ├── BalanceSelector.tsx # Starting balance picker
│   └── Logo.tsx            # PaperGMX branding
├── store/
│   └── usePaperStore.ts    # Zustand store with localStorage
├── lib/
│   └── constants.ts        # Colors, defaults, market configs
└── types/
    └── index.ts            # Core TypeScript types
```

### ✅ Done When
- [ ] App runs on localhost:3000 with dark GMX-style theme
- [ ] Landing page shows balance selection
- [ ] Clicking "Start Trading" saves balance to localStorage
- [ ] Settings panel opens/closes with animation
- [ ] USDC balance shows in header
- [ ] Works on mobile and desktop
- [ ] Code pushed to GitHub

---

## Phase 2: Market Selection & Live Prices
**Goal:** User can see 4 markets (ETH, BTC, SOL, ARB) with real-time prices from the GMX API. Clicking a market navigates to the trade setup screen.

### Tasks
| # | Task | Details |
|---|------|---------|
| 2.1 | Create Market type & config | ETH/USD, BTC/USD, SOL/USD, ARB/USD with token addresses, decimals, display configs |
| 2.2 | Build GMX API service | `lib/api/gmx.ts` — fetch from `arbitrum-api.gmxinfra.io`, endpoints: /prices/tickers, /markets/info |
| 2.3 | Build price polling hook | `usePrices()` — polls every 3 seconds, caches last response, handles errors |
| 2.4 | Build Binance WebSocket fallback | `lib/api/binance.ts` — subscribe to ticker streams, fallback if GMX API down >30s |
| 2.5 | Create Market Card component | Token icon, name, live price, 24h change %, open interest, borrow rate badge |
| 2.6 | Create Market Selection page | 4 market cards in grid, live updating prices, "Select a Market" header |
| 2.7 | Price formatting utilities | `lib/format.ts` — formatPrice (2 decimals BTC/ETH, 4 for SOL/ARB), formatUSD, formatPercent |
| 2.8 | Loading & error states | Skeleton cards while loading, "Prices may be stale" banner if API fails |
| 2.9 | Add market route | `/trade/[market]` route that receives market slug (eth, btc, sol, arb) |
| 2.10 | Navigation flow | Landing → Market Select → clicking card navigates to /trade/eth |

### File Structure (additions)
```
src/
├── app/
│   └── trade/
│       └── [market]/
│           └── page.tsx    # Trade setup page (empty shell for now)
├── components/
│   ├── MarketCard.tsx      # Single market card with live data
│   ├── MarketGrid.tsx      # Grid of 4 market cards
│   └── StalePriceBanner.tsx # Warning banner for stale data
├── hooks/
│   └── usePrices.ts        # 3-second polling hook
├── lib/
│   ├── api/
│   │   ├── gmx.ts          # GMX REST API client
│   │   └── binance.ts      # Binance WebSocket fallback
│   ├── format.ts           # Price, USD, percent formatters
│   └── constants.ts        # Updated with market configs
└── types/
    └── index.ts            # Updated with Market, PriceData types
```

### ✅ Done When
- [ ] Market selection page shows 4 markets with live prices
- [ ] Prices update every 3 seconds from GMX API
- [ ] If GMX API fails, Binance WebSocket takes over
- [ ] Cards show price, 24h change, OI, borrow rate
- [ ] Clicking a card navigates to /trade/[market]
- [ ] Loading skeletons and stale price warnings work
- [ ] Code pushed to GitHub

---

## Phase 3: Trade Setup Interface
**Goal:** The core trading form — select direction (Long/Short), enter amount, pick leverage, see fee summary. This is the heart of the app. No execution yet, just the form.

### Tasks
| # | Task | Details |
|---|------|---------|
| 3.1 | Build DirectionToggle component | [Up/Long] [Down/Short] — green/red highlight, affects all calculations |
| 3.2 | Build AmountInput component | USDC amount input, balance display, MAX button, preset buttons ($10/$25/$50/$100) |
| 3.3 | Build LeverageSelector component | [5x] [10x] [25x] [50x] buttons, 25x+ shows risk badge, affects position size |
| 3.4 | Build FeeSummary component | Position size, position fee, borrow fee (hourly), execution fee, liquidation price, total cost |
| 3.5 | Build FeeInfoExpansion component | Clickable "i" icon expands detailed fee explanations |
| 3.6 | Build SubmitButton component | Dynamic states: "Enter amount" → "Approve USDC first" → "Open Long $500" → loading states |
| 3.7 | Build TradeBox component | Container combining all above components, GMX-style card layout |
| 3.8 | Build PriceChart component (basic) | lightweight-charts AreaSeries with live price updates from Phase 2 |
| 3.9 | Build trade calculation utils | `lib/calculations.ts` — position size, fees, liquidation price, acceptable price |
| 3.10 | Wire up form state | All inputs update summary in real-time as user types |
| 3.11 | Validation | Min $1 trade, max = balance, leverage caps, amount must be positive |
| 3.12 | Disclaimer banner | "This is a simulation. Same prices & fees as GMX V2, no real risk." |

### File Structure (additions)
```
src/
├── components/
│   ├── trade/
│   │   ├── TradeBox.tsx        # Main trading card container
│   │   ├── DirectionToggle.tsx # Long/Short toggle
│   │   ├── AmountInput.tsx     # USDC amount with presets
│   │   ├── LeverageSelector.tsx # Leverage picker
│   │   ├── FeeSummary.tsx      # Fee breakdown card
│   │   ├── FeeInfoExpansion.tsx # Detailed fee explanations
│   │   └── SubmitButton.tsx    # Multi-state submit button
│   └── charts/
│       └── PriceChart.tsx      # TradingView lightweight-charts
├── lib/
│   └── calculations.ts        # All fee & position calculations
└── types/
    └── index.ts                # Updated with TradeParams, FeeBreakdown types
```

### ✅ Done When
- [ ] Trade form shows for selected market with live price chart
- [ ] Direction toggle switches between Long/Short
- [ ] Amount input validates and formats properly
- [ ] Leverage selector updates position size in real-time
- [ ] Fee summary shows all fees with correct calculations
- [ ] Submit button shows correct state for each scenario
- [ ] Form is fully responsive
- [ ] Code pushed to GitHub

---

## Phase 4: Fake Wallet Popups
**Goal:** The educational wallet simulation — MetaMask-style popups for USDC approval and order signing. This is what makes PaperGMX special.

### Tasks
| # | Task | Details |
|---|------|---------|
| 4.1 | Build WalletOverlay component | Dark overlay behind popup, prevents interaction with page |
| 4.2 | Build ApprovalPopup component | "Allow USDC to be spent?" — spender address, amount (unlimited), Approve/Reject buttons |
| 4.3 | Build SigningPopup component | "Confirm Transaction" — order details (direction, size, leverage, acceptable price), Confirm/Reject buttons |
| 4.4 | Popup animation | Slide up from bottom (300ms ease-out), framer-motion |
| 4.5 | Approval flow logic | First trade → approval popup → 1s "Processing..." → green checkmark → signing popup |
| 4.6 | Approval persistence | Save approved tokens in localStorage, skip approval on subsequent trades |
| 4.7 | Rejection handling | Reject on approval → back to trade form; Reject on signing → back to trade form |
| 4.8 | Process confirmation animation | After clicking Approve/Confirm: spinner → success checkmark (1s total) |
| 4.9 | Connect to TradeBox | Submit button triggers wallet popup flow instead of just logging |

### File Structure (additions)
```
src/
├── components/
│   └── wallet/
│       ├── WalletOverlay.tsx    # Dark background overlay
│       ├── ApprovalPopup.tsx    # USDC approval simulation
│       ├── SigningPopup.tsx     # Order signing simulation
│       └── WalletAnimator.tsx   # Handles popup transitions
├── hooks/
│   └── useWalletSimulation.ts  # State machine for wallet flow
└── store/
    └── usePaperStore.ts        # Updated with approvedTokens, walletVisible
```

### ✅ Done When
- [ ] Clicking "Approve USDC first" opens approval popup
- [ ] Approval popup shows correct contract address, amount
- [ ] Clicking Approve shows processing animation then success
- [ ] After approval, signing popup appears automatically
- [ ] Signing popup shows all order details
- [ ] Clicking Confirm triggers next phase (keeper wait)
- [ ] Clicking Reject returns to trade form cleanly
- [ ] Approval remembered in localStorage (no re-ask)
- [ ] Animations are smooth and feel like MetaMask
- [ ] Code pushed to GitHub

---

## Phase 5: Keeper Delay & Position Execution
**Goal:** The keeper wait simulation (2-8 seconds with 4-step animation), then position opens with fill price from oracle. This is where the "trade" actually happens.

### Tasks
| # | Task | Details |
|---|------|---------|
| 5.1 | Build KeeperWaitScreen component | 4-step progress: "Order submitted" → "Oracle confirming price" → "Keeper executing" → "Position opened" |
| 5.2 | Step animation logic | Gray circle → pulsing blue (active) → green checkmark (done), connecting lines animate |
| 5.3 | Timing engine | Random 2-8s weighted: 15%@2s, 30%@3s, 25%@4s, 15%@5s, 10%@6s, 5%@7s+ |
| 5.4 | Cancel button during wait | Visible during steps 1-2, cancels order, returns to trade form |
| 5.5 | Fill price logic | At keeper completion: fetch fresh oracle price, apply min/max based on direction |
| 5.6 | Acceptable price check | If fill price exceeds slippage (0.5% open), simulate order failure → "Order cancelled" screen |
| 5.7 | Build Position state | Create active position in Zustand store with: entry, direction, size, collateral, leverage, fees, timestamps |
| 5.8 | Deduct collateral from balance | On position open: deduct (collateral + position fee) from fake USDC balance |
| 5.9 | Confirmation dot animation | Yellow pulsing "Confirming..." → green "On-chain" (2-3s after fill) |
| 5.10 | Order failure handling | ~5% chance of simulated failure (price moved past slippage), shows explanation, no position created |

### File Structure (additions)
```
src/
├── components/
│   └── keeper/
│       ├── KeeperWaitScreen.tsx   # 4-step progress UI
│       ├── ProgressStep.tsx       # Single step circle + label
│       └── OrderCancelled.tsx     # Failure notification
├── lib/
│   ├── keeperTiming.ts           # Weighted random timing + step progression
│   └── priceExecution.ts         # Fill price logic, slippage check
└── store/
    └── usePaperStore.ts          # Updated with activePosition, orderState
```

### ✅ Done When
- [ ] After confirming in wallet popup, keeper wait screen shows
- [ ] 4 steps animate in sequence with correct timing
- [ ] Cancel works during steps 1-2
- [ ] Fill price is fetched from oracle at execution time
- [ ] Position appears in store with correct entry price
- [ ] Collateral + fee deducted from balance
- [ ] Order failure simulation works (~5% chance)
- [ ] Confirmation dot animation works
- [ ] Code pushed to GitHub

---

## Phase 6: Live Position & P&L Tracking
**Goal:** Open position shows with real-time P&L, live chart with entry line, position details, and close buttons. This is the main "you have a trade open" experience.

### Tasks
| # | Task | Details |
|---|------|---------|
| 6.1 | Build PositionCard component | Direction badge, entry/current price, P&L hero (large USD + %), position details |
| 6.2 | Build P&L calculation engine | Gross P&L + after-fees P&L (toggle), updates every 3s with price |
| 6.3 | Build FeeAccrualEngine | Borrow fee + funding fee accrual per-second, updates every 3s |
| 6.4 | Update PriceChart with entry line | Horizontal line at entry price, position area colored green/red |
| 6.5 | Build PositionDetails component | Collateral, size, liquidation price, borrow (accrued), funding (accrued), net P&L |
| 6.6 | Build CloseButtons component | [Take Profit] green, [Cut Loss] red — trigger close flow |
| 6.7 | Build PositionLive page | Full page for when position is open: chart + PositionCard + details |
| 6.8 | P&L after fees toggle | Settings: "Show P&L after fees" toggle, default ON |
| 6.9 | Liquidation price display | Shows real-time distance to liquidation as % and $, color warning (yellow <10%, red <5%) |
| 6.10 | "Switch to real GMX" CTA | Subtle banner: position is doing well? "Try this for real on GMX →" |

### File Structure (additions)
```
src/
├── components/
│   └── position/
│       ├── PositionCard.tsx      # Main position display card
│       ├── PositionDetails.tsx   # Detailed position metrics
│       ├── CloseButtons.tsx      # Take Profit / Cut Loss
│       ├── PnLDisplay.tsx        # Large P&L with color coding
│       └── LiquidationWarning.tsx # Distance to liquidation
├── lib/
│   ├── positionEngine.ts        # P&L calc, fee accrual, liquidation check
│   └── feeAccrual.ts            # Per-second borrow + funding accrual
└── hooks/
    └── usePositionPnL.ts        # Hook that returns live P&L
```

### ✅ Done When
- [ ] Open position shows with live P&L updating every 3s
- [ ] Chart shows entry price line
- [ ] P&L after fees shows borrow/funding eating into profits
- [ ] Close buttons visible and styled
- [ ] Liquidation distance shows with color warnings
- [ ] P&L toggle works (gross vs after-fees)
- [ ] Code pushed to GitHub

---

## Phase 7: Close Position Flow & P&L Result
**Goal:** Closing a position works end-to-end: close button → wallet signing → keeper wait → P&L result card. Full trade lifecycle complete.

### Tasks
| # | Task | Details |
|---|------|---------|
| 7.1 | Close position triggers signing popup | MarketDecrease order, 3% slippage, shows estimated P&L and receive amount |
| 7.2 | Keeper wait for close | Same 4-step animation, 2-8s delay |
| 7.3 | Close fill price logic | Close Long: oraclePrice.min, Close Short: oraclePrice.max |
| 7.4 | Calculate final P&L | Entry vs exit price, minus all fees (position open + close + borrow + funding) |
| 7.5 | Build PnLResultCard component | Full trade summary: direction, entry/exit, all fees, net P&L, duration, SIMULATION badge |
| 7.6 | Return collateral + P&L to balance | On close: add collateral + net P&L back to fake USDC balance |
| 7.7 | Save trade to history | Store closed trade in tradeHistory array in Zustand/localStorage |
| 7.8 | Share P&L feature | "Share" button copies trade summary to clipboard |
| 7.9 | Trade history list | Settings panel shows list of past trades with P&L |

### File Structure (additions)
```
src/
├── components/
│   └── position/
│       ├── PnLResultCard.tsx    # Final trade summary card
│       └── TradeHistory.tsx     # List of past trades
├── lib/
│   └── tradeHistory.ts          # Trade history management
└── store/
    └── usePaperStore.ts         # Updated with tradeHistory, closePosition()
```

### ✅ Done When
- [ ] Clicking "Take Profit" or "Cut Loss" opens signing popup
- [ ] Keeper wait animation plays for close
- [ ] Fill price calculated correctly at close time
- [ ] P&L result card shows complete fee breakdown
- [ ] Balance updates correctly (collateral + P&L returned)
- [ ] Trade saved to history
- [ ] Share button copies to clipboard
- [ ] Full open→hold→close cycle works perfectly
- [ ] Code pushed to GitHub

---

## Phase 8: Liquidation Simulation
**Goal:** If price hits liquidation price, position is forcibly closed. Full liquidation only (like real GMX). Liquidation fee deducted. Dramatic UI notification.

### Tasks
| # | Task | Details |
|---|------|---------|
| 8.1 | Build liquidation checker | Runs every 3s with price update: check if currentPrice crosses liqPrice |
| 8.2 | Build LiquidationScreen | Red flashing notification, "Position Liquidated", shows what happened |
| 8.3 | Liquidation fee deduction | 0.20% (BTC/ETH) or 0.30% (SOL/ARB) of position size, remaining collateral to "LP pool" (lost) |
| 8.4 | Time-to-liquidation estimator | If within 10% of liq price, show estimated hours/minutes until liq at current rate |
| 8.5 | Liquidation in trade history | Mark closed trades as "Liquidated" vs "Closed" |
| 8.6 | Margin call warning | At 5% distance from liq: red border pulse, "Approaching liquidation" banner |

### File Structure (additions)
```
src/
├── components/
│   └── position/
│       ├── LiquidationScreen.tsx  # Full liquidation notification
│       └── MarginCallBanner.tsx   # Warning at 5% distance
├── lib/
│   └── liquidation.ts            # Liq price calc, check, fee deduction
└── hooks/
    └── useLiquidationCheck.ts    # Runs every 3s, triggers liquidation
```

### ✅ Done When
- [ ] Position automatically liquidates when price crosses liq price
- [ ] Liquidation screen shows with explanation
- [ ] Liquidation fee calculated correctly
- [ ] Remaining collateral lost (deducted from balance)
- [ ] Trade history marks liquidated trades
- [ ] Warning banners show before liquidation
- [ ] Time-to-liquidation estimation works
- [ ] Code pushed to GitHub

---

## Phase 9: Tutorial System
**Goal:** First-time users see helpful tooltips explaining every step: what's a keeper, what's gas, what's slippage, why approve USDC, etc. Can be turned off.

### Tasks
| # | Task | Details |
|---|------|---------|
| 9.1 | Build TutorialTooltip component | Small tooltip with info icon, appears next to relevant UI elements |
| 9.2 | Write all tutorial content | 12+ tooltips: wallet approval, order signing, keeper delay, fees, slippage, liquidation, etc. |
| 9.3 | Progressive disclosure | Tooltips appear in order as user progresses through flow, not all at once |
| 9.4 | "Don't show again" per tooltip | Each tooltip has "Got it, don't show again" checkbox |
| 9.5 | Tutorial toggle in settings | Global "Tutorial Mode" on/off, default ON for new users |
| 9.6 | Tutorial reset | "Reset tutorials" button in settings to re-show all tooltips |

### ✅ Done When
- [ ] Tooltips appear at every key step for new users
- [ ] Content is educational and accurate about real GMX
- [ ] Each tooltip can be dismissed permanently
- [ ] Global toggle works
- [ ] Tutorial reset works
- [ ] Code pushed to GitHub

---

## Phase 10: One-Click Trading (1CT) Mode
**Goal:** Alternative to Classic mode. After one-time setup, trades submit instantly without wallet popups. Simulates GMX's Gelato Relay experience.

### Tasks
| # | Task | Details |
|---|------|---------|
| 10.1 | Build 1CT setup modal | "Set up gasless trading" explanation, fake wallet signing for subaccount creation |
| 10.2 | 1CT trading flow | No approval popup, no signing popup — click "Open Long ⚡" → instant keeper wait |
| 10.3 | Action counter | 90/90 actions, decrements on each order, warning at 10, expiry at 0 |
| 10.4 | 7-day expiry timer | Countdown in settings, auto-expire when done |
| 10.5 | Renewal flow | Same setup modal, resets counter and timer |
| 10.6 | Classic ↔ 1CT toggle | Settings: switch between modes anytime |
| 10.7 | 1CT promotion banner | After 3 Classic trades: "Tired of confirming? Try One-Click Trading →" |
| 10.8 | 1CT badge on submit button | "⚡ gasless" badge on Open Long/Short button when 1CT active |

### ✅ Done When
- [ ] 1CT setup flow works (fake signing + activation)
- [ ] Trades submit instantly without wallet popups in 1CT mode
- [ ] Action counter decrements correctly
- 7-day timer counts down
- [ ] Renewal works when counter/timer expires
- [ ] Toggle between Classic and 1CT works
- [ ] Promotion banner shows after 3 Classic trades
- [ ] Code pushed to GitHub

---

## Phase 11: Settings & Polish
**Goal:** Complete settings panel, balance top-up, reset, and all the quality-of-life features.

### Tasks
| # | Task | Details |
|---|------|---------|
| 11.1 | Balance display & top-up | Show current balance, "Top Up" button with custom amount, adds to existing balance |
| 11.2 | Reset wallet | "Reset & Start Over" — clears all localStorage, returns to landing page |
| 11.3 | Tutorial toggle | Already built in Phase 9, ensure it's in settings |
| 11.4 | Trading mode toggle | Classic vs 1CT (already built in Phase 10) |
| 11.5 | P&L display mode toggle | "Show P&L after fees" on/off |
| 11.6 | Keeper delay toggle | "Simulate keeper delay" on/off (off = instant execution for power users) |
| 11.7 | Trade history view | Full list of past trades in settings panel |
| 11.8 | Disclaimer & about | "This is a simulation" disclaimer, version info, link to real GMX |
| 11.9 | "Switch to Real Trading" CTA | Link to mainnet EasyGMX or app.gmx.io |

### ✅ Done When
- [ ] All settings work correctly
- [ ] Top-up adds to balance
- [ ] Reset clears everything and returns to landing
- [ ] All toggles persist in localStorage
- [ ] Trade history is complete and viewable
- [ ] Code pushed to GitHub

---

## Phase 12: Final Polish & Deployment
**Goal:** Production-ready. Responsive, fast, beautiful, deployed.

### Tasks
| # | Task | Details |
|---|------|---------|
| 12.1 | Mobile optimization | Every screen works perfectly on mobile (375px width) |
| 12.2 | Animation polish | All transitions smooth, no jank, framer-motion spring configs |
| 12.3 | Loading states | Every async operation has skeleton or spinner |
| 12.4 | Error boundaries | Catch and display errors gracefully |
| 12.5 | Performance audit | Lighthouse >90 on all metrics |
| 12.6 | SEO & meta tags | Title, description, OG image for social sharing |
| 12.7 | Deploy to Vercel | `vercel deploy` from repo |
| 12.8 | Custom domain | Point papergmx.com or similar |
| 12.9 | Final testing | Complete trade lifecycle on all 4 markets, both modes |

### ✅ Done When
- [ ] App deployed and accessible via URL
- [ ] Works on mobile, tablet, desktop
- [ ] All animations smooth
- [ ] No errors or crashes in normal usage
- [ ] Lighthouse score >90
- [ ] Code pushed to GitHub

---

## Summary

| Phase | What You Get | Est. Time |
|-------|-------------|-----------|
| 1 | Running app with dark theme, landing page, balance selection | Build session 1 |
| 2 | Live prices from GMX API, market selection | Build session 1 |
| 3 | Full trading form with fee calculations | Build session 2 |
| 4 | Fake wallet popups (the magic!) | Build session 2 |
| 5 | Keeper delay + position execution | Build session 3 |
| 6 | Live P&L tracking, chart with entry line | Build session 3 |
| 7 | Close position + P&L result (full lifecycle!) | Build session 4 |
| 8 | Liquidation simulation | Build session 4 |
| 9 | Tutorial tooltips system | Build session 5 |
| 10 | One-Click Trading mode | Build session 5 |
| 11 | Settings, top-up, reset, history | Build session 5 |
| 12 | Polish & deploy | Build session 6 |

**Total: ~6 focused build sessions to a fully working paper trading app.**

We perfect each phase before moving on. No skipping ahead. 🔥
