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
  minPrice: number;  // Already converted from 30-decimal
  maxPrice: number;
  midPrice: number;
  updatedAt: number; // ms timestamp
  isStale: boolean;  // true if updatedAt is > 30s ago
}

/** Validated and parsed market info for a single market */
export interface ParsedMarketInfo {
  marketSlug: string;
  name: string;
  indexToken: string;
  longOiUsd: number;
  shortOiUsd: number;
  totalOiUsd: number;
  borrowRateLongPerSecond: number;
  borrowRateShortPerSecond: number;
  borrowRateLongAnnualized: number; // annualized % for display (e.g., 45.2)
  borrowRateShortAnnualized: number; // annualized % for display
  fundingRatePerSecond: number;
  fundingRateAnnualized: number; // annualized % for display
  positionFeeBps: number; // 4 or 6 BPS — TODO: dynamic at execution time based on OI balance
}

// Re-export ApiConnectionStatus from the central types module
export type { ApiConnectionStatus } from "@/types";
