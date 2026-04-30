// ─── Core Types for PaperGMX ─────────────────────────────

export type TradingMode = "classic" | "1ct";

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

export interface MarketConfig {
  slug: MarketSlug;
  name: string;
  symbol: string;
  pair: string;
  decimals: number;
  icon: string;
  maintenanceMarginPercent: number;
  liquidationFeePercent: number;
  maxLeverage: number;
}

export interface Position {
  id: string;
  market: MarketSlug;
  direction: OrderDirection;
  collateralUsd: number;
  leverage: number;
  sizeUsd: number;
  entryPrice: number;
  acceptablePrice: number;
  liquidationPrice: number;
  positionFeePaid: number;
  borrowFeeAccrued: number;
  fundingFeeAccrued: number;
  openedAt: number;
  confirmedAt: number | null;
  status: "confirming" | "active" | "closed" | "liquidated";
}

export interface ClosedTrade {
  id: string;
  market: MarketSlug;
  direction: OrderDirection;
  leverage: number;
  sizeUsd: number;
  entryPrice: number;
  exitPrice: number;
  collateralUsd: number;
  positionFeeOpen: number;
  positionFeeClose: number;
  borrowFeeTotal: number;
  fundingFeeTotal: number;
  netPnl: number;
  grossPnl: number;
  openedAt: number;
  closedAt: number;
  closeReason: "take_profit" | "cut_loss" | "liquidated";
}

export interface PriceData {
  min: number;
  max: number;
  last: number;
  change24h: number;
}

export interface MarketInfo {
  slug: MarketSlug;
  longOi: number;
  shortOi: number;
  borrowRateLong: number;
  borrowRateShort: number;
  fundingRate: number;
  positionFeePercent: number;
}

export interface OneClickTradingState {
  enabled: boolean;
  activatedAt: number | null;
  actionsRemaining: number;
  expiresAt: number | null;
}

export interface PaperStoreState {
  // Wallet
  balance: number;
  isInitialized: boolean;
  approvedTokens: string[];

  // Position
  activePosition: Position | null;
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

  // Settings panel
  settingsOpen: boolean;

  // Actions
  initializeBalance: (amount: number) => void;
  topUpBalance: (amount: number) => void;
  resetWallet: () => void;
  approveToken: (token: string) => void;
  setActivePosition: (position: Position | null) => void;
  setOrderStatus: (status: OrderStatus) => void;
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
  updatePositionFees: (borrowFeeDelta: number, fundingFeeDelta: number) => void;
  closePosition: (exitPrice: number, closeReason: ClosedTrade["closeReason"]) => void;
}
