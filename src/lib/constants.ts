import type { MarketSlug } from "@/types";
import { bps } from "@/lib/branded";

// ─── GMX Color Constants ──────────────────────────────────
// NOTE: These color constants are for reference only.
// The actual theme is defined in globals.css via CSS custom properties.
// Keep both in sync.
export const COLORS = {
  bgPrimary: "#0a0a0f",
  bgCard: "#1a1a2e",
  bgCardHover: "#222240",
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
export const MARKETS: Record<MarketSlug, import("@/types").MarketConfig> = {
  eth: {
    slug: "eth",
    name: "Ethereum",
    symbol: "ETH",
    pair: "ETH/USD",
    decimals: 2,
    icon: "⟠",
    maintenanceMarginBps: bps(50), // 0.5%
    liquidationFeeBps: bps(20), // 0.2%
    maxLeverage: 50,
  },
  btc: {
    slug: "btc",
    name: "Bitcoin",
    symbol: "BTC",
    pair: "BTC/USD",
    decimals: 2,
    icon: "₿",
    maintenanceMarginBps: bps(50), // 0.5%
    liquidationFeeBps: bps(20), // 0.2%
    maxLeverage: 50,
  },
  sol: {
    slug: "sol",
    name: "Solana",
    symbol: "SOL",
    pair: "SOL/USD",
    decimals: 4,
    icon: "◎",
    maintenanceMarginBps: bps(100), // 1.0%
    liquidationFeeBps: bps(30), // 0.3%
    maxLeverage: 25,
  },
  arb: {
    slug: "arb",
    name: "Arbitrum",
    symbol: "ARB",
    pair: "ARB/USD",
    decimals: 4,
    icon: "◆",
    maintenanceMarginBps: bps(100), // 1.0%
    liquidationFeeBps: bps(30), // 0.3%
    maxLeverage: 25,
  },
};

export const MARKET_SLUGS = Object.keys(MARKETS) as MarketSlug[];

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

// ─── Fee Rates (in BPS) ───────────────────────────────────
// GMX V2: 4 BPS (0.04%) if trade balances pool, 6 BPS (0.06%) if it imbalances
export const POSITION_FEE_BALANCING_BPS = bps(4); // 0.04%
export const POSITION_FEE_IMBALANCING_BPS = bps(6); // 0.06%
export const DEFAULT_POSITION_FEE_BPS = bps(6); // Default to imbalancing (conservative)

// ─── Slippage (in BPS) ────────────────────────────────────
export const SLIPPAGE_OPEN_BPS = bps(50); // 0.5% for open
export const SLIPPAGE_CLOSE_BPS = bps(300); // 3% for close

// ─── Keeper Timing Weights (seconds) ─────────────────────
export const KEEPER_TIMING_WEIGHTS = [
  { seconds: 2, weight: 15 },
  { seconds: 3, weight: 30 },
  { seconds: 4, weight: 25 },
  { seconds: 5, weight: 15 },
  { seconds: 6, weight: 10 },
  { seconds: 7, weight: 5 },
] as const;

/** Sample a keeper delay from the weighted distribution. */
export function sampleKeeperDelay(): number {
  const totalWeight = KEEPER_TIMING_WEIGHTS.reduce(
    (sum, d) => sum + d.weight,
    0,
  );
  let random = Math.random() * totalWeight;
  for (const delay of KEEPER_TIMING_WEIGHTS) {
    random -= delay.weight;
    if (random <= 0) return delay.seconds * 1000;
  }
  return 3000;
}

/** Simulated keeper execution failure rate (5%). */
export const KEEPER_FAILURE_RATE = 0.05;

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

// ─── Position ID Generation ───────────────────────────────
export function generatePositionId(
  market: MarketSlug,
  direction: string,
): string {
  // Append random suffix to prevent collisions under rapid trading
  return `${market}-${direction}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}
