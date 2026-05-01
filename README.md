# PaperGMX — Real prices. Real fees. Fake money.

A paper trading simulator for **GMX V2 perpetual futures** on Arbitrum. Practice leveraged trading with live oracle prices and exact fee structures — without risking any real crypto.

**No wallet. No crypto. No risk. Just learning.**

---

## ✨ Features

- 🎯 **Live GMX V2 Prices** — Real-time oracle data from `arbitrum-api.gmxinfra.io`, with Binance WebSocket fallback
- 📊 **4 Perpetual Markets** — ETH/USD, BTC/USD, SOL/USD, ARB/USD with accurate market configs
- 💰 **Exact Fee Simulation** — Position fees (0.04–0.06%), borrow rates, funding rates, and liquidation fees calculated like real GMX
- 🔄 **Full Trade Lifecycle** — Open → hold → close with live P&L tracking, fee accrual, and keeper execution simulation
- 📱 **Fake Wallet Popups** — MetaMask-style approval & signing popups that simulate the real GMX trading UX
- ⏱️ **Keeper Delay Simulation** — 2–8 second weighted random execution delay with 4-step progress animation
- ⚡ **One-Click Trading (1CT)** — Skip wallet approvals for faster trading, with 90-action/7-day limits (like real Gelato Relay)
- 📉 **Liquidation Simulation** — Automatic liquidation when price crosses liquidation threshold, with margin warnings
- 🎓 **Tutorial Tooltips** — Contextual hints for new users that explain every step of the trading flow
- 💼 **Balance Management** — Start with $10K / $100K / $1M, top up anytime
- 📈 **Real-Time Chart** — TradingView Lightweight Charts with live price updates and entry price markers
- 🏦 **Branded Types** — `USD`, `Price`, `BPS`, `Percent` — TypeScript prevents mixing up financial values
- 🔄 **State Machine** — Strict order status transitions enforced at the type level

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + custom GMX dark theme |
| State | Zustand with localStorage persistence |
| Animations | Framer Motion |
| Icons | @heroicons/react |
| Charts | TradingView Lightweight Charts |
| Price API | GMX Arbitrum API + Binance WebSocket fallback |
| Testing | Vitest + Testing Library |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ or Bun
- npm, yarn, pnpm, or bun

### Install

```bash
git clone https://github.com/your-username/PaperGMX.git
cd PaperGMX
npm install
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Test

```bash
npm run test:run
```

### Lint

```bash
npm run lint
```

---

## 📁 Project Structure

```
src/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Landing page — balance selection
│   ├── markets/page.tsx        # Market selection grid
│   ├── trade/[market]/page.tsx # Trading interface
│   ├── layout.tsx              # Root layout with dark theme
│   ├── globals.css             # Tailwind + GMX theme variables
│   └── error.tsx               # Error boundary
├── components/
│   ├── Header.tsx              # Top bar — logo, balance, settings
│   ├── SettingsPanel.tsx       # Slide-out settings drawer
│   ├── BalanceSelector.tsx     # Starting balance picker
│   ├── Logo.tsx                # PaperGMX branding
│   ├── tutorial/
│   │   └── TutorialTooltip.tsx # Contextual hint tooltips
│   ├── trade/
│   │   ├── OrderEntryForm.tsx  # Main trading form container
│   │   ├── DirectionToggle.tsx # Long/Short toggle
│   │   ├── CollateralInput.tsx # USDC amount input with presets
│   │   ├── LeverageSlider.tsx  # Leverage selector
│   │   ├── OrderSummary.tsx    # Fee breakdown card
│   │   ├── SubmitOrderButton.tsx # Multi-state submit button
│   │   ├── MarketCard.tsx      # Single market card
│   │   ├── MarketGrid.tsx      # 4-market grid
│   │   ├── MarketPriceBar.tsx  # Live price display
│   │   ├── PriceChart.tsx      # TradingView chart
│   │   └── OneClickSetupModal.tsx # 1CT setup & management
│   ├── wallet/
│   │   ├── WalletOverlay.tsx   # Dark overlay behind popups
│   │   ├── WalletAnimator.tsx  # Popup transition wrapper
│   │   ├── ApprovalPopup.tsx   # USDC approval simulation
│   │   ├── SigningPopup.tsx    # Order signing simulation
│   │   └── shared.tsx          # Shared wallet UI components
│   ├── keeper/
│   │   ├── KeeperWaitScreen.tsx # 4-step execution progress
│   │   └── OrderResultScreen.tsx # Failed/cancelled result
│   └── position/
│       ├── PositionCard.tsx    # Active position display
│       ├── ClosePositionForm.tsx # Take profit / cut loss
│       ├── LiquidationScreen.tsx # Liquidation notification
│       └── MarginWarning.tsx   # Approaching liquidation banner
├── hooks/
│   ├── usePriceService.ts      # 3-second price polling
│   ├── useWalletSimulation.ts  # Wallet popup state machine
│   ├── useKeeperExecution.ts   # Keeper delay & step progression
│   ├── useCloseKeeper.ts       # Close position keeper flow
│   ├── usePositionPnl.ts       # Live P&L calculation
│   └── useLiquidationChecker.ts # Auto-liquidation detection
├── lib/
│   ├── api/
│   │   ├── gmx.ts             # GMX REST API client
│   │   ├── gmxPrice.ts        # Price parsing & mapping
│   │   ├── binance.ts         # Binance WebSocket fallback
│   │   └── priceService.ts    # Unified price service
│   ├── calculations/           # Pure calculation functions
│   ├── branded.ts             # Branded types (USD, Price, BPS)
│   ├── constants.ts           # Markets, fees, timing configs
│   ├── format.ts              # Price, USD, percent formatters
│   └── validation.ts          # Input validation
├── store/
│   └── usePaperStore.ts       # Zustand store (persisted)
└── types/
    └── index.ts               # All TypeScript types & state machine
```

---

## 🗺 Roadmap Status

### ✅ Completed

| Phase | Feature |
|-------|---------|
| Phase 1 | Project foundation, dark theme, layout shell |
| Phase 2 | Market selection, live GMX prices, Binance fallback |
| Phase 3 | Trade setup form, fee calculations, leverage selector |
| Phase 4 | Fake wallet popups (approval + signing) |
| Phase 5 | Keeper delay simulation, position execution |
| Phase 6 | Live position, P&L tracking, fee accrual |
| Phase 7 | Close position flow, P&L result card, trade history |
| Phase 8 | Liquidation simulation, margin warnings |
| Phase 9 | Tutorial tooltip system with per-tooltip dismiss |
| Phase 10 | One-Click Trading mode with setup modal |
| Phase 11 | Settings panel, balance top-up, reset, preferences |

### 🔜 Planned

| Phase | Feature |
|-------|---------|
| Phase 12 | Mobile optimization, animation polish, deployment |

---

## 🏗 Architecture Overview

### Price Service

Real-time prices are fetched from the **GMX Arbitrum API** every 3 seconds. If the API becomes unavailable or slow (>30s), the system automatically falls back to **Binance WebSocket** streams. The connection status is displayed in the header with a color-coded pulse indicator.

### State Machine

Order transitions are strictly enforced via `ORDER_TRANSITIONS` in `src/types/index.ts`. Invalid transitions (e.g., `idle → filled`) are blocked at runtime with console warnings. This mirrors real smart contract behavior where invalid state transitions revert.

```
idle → approving → approved → signing → submitted → keeper_step_1 → ... → keeper_step_4 → filled
idle → signing (1CT or already approved)
```

### Branded Types

Financial values use TypeScript branded types to prevent accidental mixing:

- `USD` — US dollar amounts (balance, collateral, fees)
- `Price` — Token prices (ETH $3,500, BTC $100,000)
- `BPS` — Basis points (position fees, slippage)
- `Percent` — Percentage values (24h change, P&L %)
- `Timestamp` — Unix timestamps

---

## 📄 License

MIT
