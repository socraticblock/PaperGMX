/**
 * GMX API Response Types
 * These match the EXACT shape returned by the GMX Arbitrum API.
 * All big numbers are strings — we never trust the API to return numbers.
 */

/** Raw ticker from /prices/tickers */
export interface GmxTickerResponse {
  tokenAddress: string;
  tokenSymbol: string;
  minPrice: string;
  maxPrice: string;
  updatedAt: number;
  timestamp: number;
}

/** Raw market info from /markets/info */
export interface GmxMarketInfoResponse {
  name: string;
  marketToken: string;
  indexToken: string;
  longToken: string;
  shortToken: string;
  isListed: boolean;
  listingDate: string;
  openInterestLong: string;
  openInterestShort: string;
  availableLiquidityLong: string;
  availableLiquidityShort: string;
  poolAmountLong: string;
  poolAmountShort: string;
  fundingRateLong: string;
  fundingRateShort: string;
  borrowingRateLong: string;
  borrowingRateShort: string;
  netRateLong: string;
  netRateShort: string;
}

/** Token info from /tokens */
export interface GmxTokenResponse {
  symbol: string;
  address: string;
  decimals: number;
}

/** Validated and parsed price data for a single market */
export interface ParsedMarketPrice {
  marketSlug: string;
  symbol: string;
  minPrice: number; // Already converted from 30-decimal
  maxPrice: number;
  midPrice: number;
  /** 24h quote volume in USD when available (e.g. Binance miniTicker `q`) */
  volume24hUsd?: number;
  updatedAt: number; // ms timestamp
  isStale: boolean; // true if updatedAt is > 30s ago
}

/** Validated and parsed market info for a single market */
export interface ParsedMarketInfo {
  marketSlug: string;
  name: string;
  indexToken: string;
  longOiUsd: number;
  shortOiUsd: number;
  totalOiUsd: number;
  availableLiquidityLongUsd: number;
  availableLiquidityShortUsd: number;
  totalLiquidityUsd: number;
  poolAmountLongUsd: number;
  poolAmountShortUsd: number;
  maxOpenInterestLongUsd: number;
  maxOpenInterestShortUsd: number;
  borrowRateLongPerSecond: number;
  borrowRateShortPerSecond: number;
  borrowRateLongAnnualized: number; // annualized % for display (e.g., 45.2)
  borrowRateShortAnnualized: number; // annualized % for display
  fundingRateLongPerSecond: number;
  fundingRateShortPerSecond: number;
  fundingRateLongAnnualized: number; // annualized % for display
  fundingRateShortAnnualized: number; // annualized % for display
  netRateLongAnnualized: number; // annualized % for display
  netRateShortAnnualized: number; // annualized % for display
  positionFeeBps: number; // 4 or 6 BPS — TODO: dynamic at execution time based on OI balance

  // ─── GMX V2 per-market factors ───
  /** Max PnL factor for traders (fraction of sizeUsd). GMX on-chain default: 0.5 */
  maxPnlFactorForTraders: number;
}

// Re-export ApiConnectionStatus from the central types module
export type { ApiConnectionStatus } from "@/types";
