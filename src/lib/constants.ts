import type { MarketConfig } from "@/types";

// ─── GMX Color Constants ──────────────────────────────────
export const COLORS = {
  bgPrimary: "#0a0a0f",
  bgCard: "#14141f",
  bgCardHover: "#1a1a2e",
  bgInput: "#0f0f1a",
  borderPrimary: "#2a2a3e",
  borderHover: "#3a3a4e",
  textPrimary: "#ffffff",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  bluePrimary: "#418cf5",
  blueHover: "#5a9df7",
  greenPrimary: "#22c55e",
  greenBg: "rgba(34, 197, 94, 0.1)",
  redPrimary: "#ef4444",
  redBg: "rgba(239, 68, 68, 0.1)",
  yellowPrimary: "#eab308",
  yellowBg: "rgba(234, 179, 8, 0.1)",
  purplePrimary: "#a855f7",
} as const;

// ─── Market Configurations ────────────────────────────────
export const MARKETS: Record<string, MarketConfig> = {
  eth: {
    slug: "eth",
    name: "Ethereum",
    symbol: "ETH",
    pair: "ETH/USD",
    decimals: 2,
    icon: "⟠",
    maintenanceMarginPercent: 0.5,
    liquidationFeePercent: 0.2,
    maxLeverage: 50,
  },
  btc: {
    slug: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    pair: "BTC/USD",
    decimals: 2,
    icon: "₿",
    maintenanceMarginPercent: 0.5,
    liquidationFeePercent: 0.2,
    maxLeverage: 50,
  },
  sol: {
    slug: "sol",
    name: "Solana",
    symbol: "SOL",
    pair: "SOL/USD",
    decimals: 4,
    icon: "◎",
    maintenanceMarginPercent: 1.0,
    liquidationFeePercent: 0.3,
    maxLeverage: 25,
  },
  arb: {
    slug: "arb",
    name: "Arbitrum",
    symbol: "ARB",
    pair: "ARB/USD",
    decimals: 4,
    icon: "◆",
    maintenanceMarginPercent: 1.0,
    liquidationFeePercent: 0.3,
    maxLeverage: 25,
  },
};

export const MARKET_SLUGS = Object.keys(MARKETS) as string[];

// ─── Balance Presets ──────────────────────────────────────
export const BALANCE_PRESETS = [
  { label: "$10K", value: 10_000 },
  { label: "$100K", value: 100_000 },
  { label: "$1M", value: 1_000_000 },
] as const;

// ─── Leverage Presets ─────────────────────────────────────
export const LEVERAGE_PRESETS = [5, 10, 25, 50] as const;

// ─── Amount Presets ───────────────────────────────────────
export const AMOUNT_PRESETS = [10, 25, 50, 100] as const;

// ─── Trading Defaults ─────────────────────────────────────
export const DEFAULT_BALANCE = 0;
export const DEFAULT_LEVERAGE = 5;
export const MIN_TRADE_AMOUNT = 1;
export const MAX_BALANCE = 10_000_000;

// ─── Slippage ─────────────────────────────────────────────
export const SLIPPAGE_OPEN = 0.005; // 0.5% for open
export const SLIPPAGE_CLOSE = 0.03; // 3% for close

// ─── Keeper Timing Weights (seconds) ─────────────────────
export const KEEPER_TIMING_WEIGHTS = [
  { seconds: 2, weight: 15 },
  { seconds: 3, weight: 30 },
  { seconds: 4, weight: 25 },
  { seconds: 5, weight: 15 },
  { seconds: 6, weight: 10 },
  { seconds: 7, weight: 5 },
] as const;

// ─── 1CT Settings ─────────────────────────────────────────
export const ONE_CLICK_MAX_ACTIONS = 90;
export const ONE_CLICK_DURATION_DAYS = 7;
export const ONE_CLICK_WARNING_THRESHOLD = 10;

// ─── GMX API ──────────────────────────────────────────────
export const GMX_API_BASE = "https://arbitrum-api.gmxinfra.io";
export const PRICE_POLL_INTERVAL = 3000; // 3 seconds

// ─── Binance WebSocket ────────────────────────────────────
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws";
export const BINANCE_FALLBACK_TIMEOUT = 30_000; // 30 seconds

// ─── GMX Contract Addresses (for display in wallet popup) ─
export const GMX_CONTRACTS = {
  syntheticsRouter: "0x7452c5540099528B5D3A328eDD2c1C35f1C53Bb8",
  exchangeRouter: "0x7C68C7866A64FA2160F78EEaE12217FFbf871fa8",
  usdc: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
} as const;

// ─── Fake Wallet Address (for display) ────────────────────
export const FAKE_WALLET_ADDRESS = "0x7a3b...4f2e";
