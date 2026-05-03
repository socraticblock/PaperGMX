// ─── Core Types for PaperGMX ─────────────────────────────
// All financial values use branded types from @/lib/branded
// to prevent accidental mixing of USD, Price, BPS, etc.

// Re-export branded types so consumers only need one import path
export type { USD, Price, BPS, Percent, Timestamp } from "@/lib/branded";
export {
  usd,
  price,
  bps,
  percent,
  timestamp,
  bpsToDecimal,
  applyBps,
  addUSD,
  subUSD,
  mulUSD,
} from "@/lib/branded";

import type { USD, Price, BPS, Percent, Timestamp } from "@/lib/branded";

export type TradingMode = "classic" | "1ct";

/** Entry intent for the trade form only. Limit execution is not simulated yet. */
export type EntryOrderType = "market" | "limit";

export type OrderDirection = "long" | "short";

export type OrderType = "market_increase" | "market_decrease";

export type MarketSlug = "eth" | "btc" | "sol" | "arb";

export type OrderStatus =
  | "idle"
  | "approving"
  | "approved"
  | "signing"
  | "submitted"
  | "keeper_step_1"
  | "keeper_step_2"
  | "keeper_step_3"
  | "keeper_step_4"
  | "filled"
  | "cancelled"
  | "failed";

// ─── Order State Machine ──────────────────────────────────

export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  idle: ["approving", "signing"], // signing if already approved or 1CT
  approving: ["approved", "failed", "cancelled"],
  approved: ["signing", "failed"],
  signing: ["submitted", "failed", "cancelled"],
  submitted: ["keeper_step_1", "failed", "cancelled"],
  keeper_step_1: ["keeper_step_2", "failed", "cancelled"],
  keeper_step_2: ["keeper_step_3", "failed", "cancelled"],
  keeper_step_3: ["keeper_step_4", "failed", "cancelled"], // cancelled for slippage
  keeper_step_4: ["filled", "failed", "cancelled"], // cancelled for slippage
  filled: ["idle"], // User dismisses the order result to return to idle
  cancelled: ["idle"],
  failed: ["idle"],
} as const;

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] as readonly OrderStatus[]).includes(to);
}

// ─── Market ───────────────────────────────────────────────

export interface MarketConfig {
  slug: MarketSlug;
  name: string;
  symbol: string;
  pair: string;
  decimals: number;
  icon: string;
  maintenanceMarginBps: BPS; // 50 (0.5%) for BTC/ETH, 100 (1.0%) for SOL/ARB
  liquidationFeeBps: BPS; // 20 (0.2%) for BTC/ETH, 30 (0.3%) for SOL/ARB
  maxLeverage: number;
}

// ─── Position ─────────────────────────────────────────────

export interface Position {
  id: string; // "{market}-{direction}-{timestamp}"
  market: MarketSlug;
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  sizeUsd: USD;
  /** Position size in index tokens (sizeUsd / entryPrice at open). */
  sizeInTokens?: number;
  entryPrice: Price;
  acceptablePrice: Price;
  liquidationPrice: Price | null;
  positionFeeBps: BPS;
  positionFeePaid: USD;
  borrowFeeAccrued: USD;
  fundingFeeAccrued: USD;
  /**
   * End of the last window where borrow/funding deltas were applied (ms).
   * Used for wall-clock accrual across sessions (matches on-chain continuous accrual
   * in intent; rates still come from the latest GMX API snapshot per tick).
   */
  lastFeeAccrualAt: Timestamp;
  openedAt: Timestamp;
  confirmedAt: Timestamp | null;
  status: "confirming" | "active" | "closed" | "liquidated";
}

export interface ClosedTrade {
  id: string;
  market: MarketSlug;
  direction: OrderDirection;
  leverage: number;
  sizeUsd: USD;
  sizeInTokens?: number;
  entryPrice: Price;
  exitPrice: Price;
  collateralUsd: USD;
  positionFeeOpen: USD;
  positionFeeClose: USD;
  borrowFeeTotal: USD;
  fundingFeeTotal: USD;
  netPnl: USD;
  grossPnl: USD;
  /** Gross PnL before the maxPnlFactorForTraders cap (same as grossPnl if uncapped) */
  grossPnlUncapped: USD;
  /** Amount clipped off by maxPnlFactorForTraders (0 if not capped) */
  pnlCappedAmount: USD;
  returnedCollateral: USD;
  openedAt: Timestamp;
  closedAt: Timestamp;
  closeReason: "take_profit" | "cut_loss" | "liquidated";
}

// ─── Price Data ───────────────────────────────────────────

export interface PriceData {
  min: Price;
  max: Price;
  last: Price;
  // TODO: Phase 4 — implement price history tracking to compute real 24h change
  change24h: Percent;
  /** Optional 24h quote volume (USD) when provided by data source. */
  volume24hUsd?: USD;
}

export interface MarketInfo {
  slug: MarketSlug;
  longOi: USD;
  shortOi: USD;
  availableLiquidityLong: USD;
  availableLiquidityShort: USD;
  totalLiquidityUsd: USD;
  borrowRateLong: number; // per-second (for calculations)
  borrowRateShort: number; // per-second (for calculations)
  borrowRateLongAnnualized: number; // annualized % (for display)
  borrowRateShortAnnualized: number; // annualized % (for display)
  fundingRateLong: number; // per-second (for calculations)
  fundingRateShort: number; // per-second (for calculations)
  fundingRateLongAnnualized: number; // annualized % (for display)
  fundingRateShortAnnualized: number; // annualized % (for display)
  netRateLongAnnualized: number; // annualized % (for display)
  netRateShortAnnualized: number; // annualized % (for display)
  positionFeeBps: BPS; // 4 or 6 BPS depending on OI balance

  // ─── GMX V2 per-market factors (from Reader contract) ───
  /** Caps positive trader PnL as fraction of sizeUsd. GMX default: 0.5 (50%). */
  maxPnlFactorForTraders: number;
  /** Whether the pool's balance improved after the trade (for fee classification). */
  // Note: balanceWasImproved is computed at trade time, not stored on MarketInfo.
  // See positionEngine.determineBalanceWasImproved() for the before/after delta logic.
}

// ─── 1CT ──────────────────────────────────────────────────

export interface OneClickTradingState {
  enabled: boolean;
  activatedAt: Timestamp | null;
  actionsRemaining: number;
  expiresAt: Timestamp | null;
}

// ─── Store ────────────────────────────────────────────────

export type ApiConnectionStatus =
  | "connected" // GMX Oracle Keeper API — fresh prices
  | "degraded" // GMX API responding but data is stale or partially failing
  | "disconnected"; // Cannot load GMX oracle prices (same source as app.gmx.io infra)

export interface PaperStoreState {
  // Wallet
  balance: USD;
  isInitialized: boolean;
  approvedTokens: string[];

  // Prices (not persisted — always fresh from API)
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
  connectionStatus: ApiConnectionStatus;
  pricesLoaded: boolean;

  // Positions — multi-position model keyed by (market, direction).
  // Real GMX V2 keys positions as (account, market, collateralToken, isLong);
  // PaperGMX is single-user and v1 is USDC-only collateral, so account and
  // collateralToken are implicit. isLong is part of the key, so a user CAN
  // hold both a long and a short on the same market (matches GMX hedge mode).
  positions: Position[];
  /** ID of the currently focused position (drives the chart overlay). */
  selectedPositionId: string | null;
  orderStatus: OrderStatus;

  // History
  tradeHistory: ClosedTrade[];

  // Settings
  tutorialEnabled: boolean;
  tutorialDismissed: Record<string, boolean>;
  tradingMode: TradingMode;
  showPnlAfterFees: boolean;
  simulateKeeperDelay: boolean;

  // 1CT
  oneClickTrading: OneClickTradingState;

  // UI
  settingsOpen: boolean;

  // Actions
  initializeBalance: (amount: number) => void;
  topUpBalance: (amount: number) => void;
  resetWallet: () => void;
  approveToken: (token: string) => void;
  lockCollateral: (amount: USD) => void;

  // ─── Multi-position actions ─────────────────────────────
  /** Append a new position. Auto-selects it if no position is currently selected. */
  addPosition: (position: Position) => void;
  /** Patch a single position by id. No-op if id not found. */
  updatePosition: (id: string, patch: Partial<Position>) => void;
  /** Remove a single position by id. Advances selection if needed. */
  removePosition: (id: string) => void;
  /** Set the currently focused position (drives chart overlay). */
  selectPosition: (id: string | null) => void;
  /**
   * GMX-style increase: merges a new fill into an existing position using
   * weighted-average entry (sizeUsd / sizeInTokens). Recomputes liquidation
   * price from the new totals and resets the fee accrual checkpoint.
   * No-op if id not found.
   */
  increasePosition: (
    id: string,
    args: {
      sizeDeltaUsd: USD;
      collateralDeltaUsd: USD;
      executionPrice: Price;
      openFeeUsd: USD;
      now: Timestamp;
    },
  ) => void;

  setOrderStatus: (status: OrderStatus) => void;
  /** Dismiss the current order result (filled/failed/cancelled) and return to idle. */
  dismissOrderResult: () => void;
  addClosedTrade: (trade: ClosedTrade) => void;
  setSettingsOpen: (open: boolean) => void;
  setTutorialEnabled: (enabled: boolean) => void;
  dismissTutorial: (key: string) => void;
  setTradingMode: (mode: TradingMode) => void;
  setShowPnlAfterFees: (show: boolean) => void;
  setSimulateKeeperDelay: (simulate: boolean) => void;
  enableOneClickTrading: () => void;
  disableOneClickTrading: () => void;
  decrementOneClickActions: () => void;
  renewOneClickTrading: () => void;
  updatePositionFees: (
    id: string,
    borrowFeeDelta: USD,
    fundingFeeDelta: USD,
    accrualEndAt?: Timestamp,
  ) => void;
  closePosition: (
    id: string,
    exitPrice: Price,
    closeReason: ClosedTrade["closeReason"],
    closeFeeBpsOverride?: BPS,
  ) => void;
  setPrices: (prices: Record<MarketSlug, PriceData>) => void;
  setMarketInfo: (info: Record<MarketSlug, MarketInfo>) => void;
  setConnectionStatus: (status: ApiConnectionStatus) => void;
}
