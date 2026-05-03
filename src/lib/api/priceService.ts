/**
 * Unified Price Service — GMX only
 *
 * PaperGMX uses the same Arbitrum oracle keeper API as the live GMX interface
 * (`arbitrum-api.gmxinfra.io`). There is no alternate venue for execution
 * prices: if GMX data is unavailable, we show an explicit status and do not
 * substitute third-party feeds.
 *
 * - Prices: polled every 3 seconds
 * - Market info (OI, borrow/funding): polled every 5 seconds
 *
 * Circuit breaker (from `gmx.ts`): after repeated failures, requests pause
 * briefly before retrying.
 */

import type { MarketSlug } from "@/types";
import type {
  ParsedMarketPrice,
  ParsedMarketInfo,
  ApiConnectionStatus,
} from "./types";
import { fetchMarketPrices, fetchMarketInfo, getApiStatus } from "./gmx";

// ─── Config ───────────────────────────────────────────────

const PRICE_POLL_INTERVAL_MS = 3_000;
/** Align with GMX docs: `/markets/info` funding rates refresh ~every 5s */
const MARKET_INFO_POLL_INTERVAL_MS = 5_000;
/** If no successful GMX price fetch within this window, status → degraded */
const STALE_ORACLE_THRESHOLD_MS = 30_000;

// ─── State ────────────────────────────────────────────────

let priceIntervalId: ReturnType<typeof setInterval> | null = null;
let marketInfoIntervalId: ReturnType<typeof setInterval> | null = null;

let lastSuccessfulGmxFetch = 0;
let gmxOutageStartedAt: number | null = null;
let isServiceRunning = false;
let isPolling = false;
let consumerCount = 0;

type PriceUpdateCallback = (
  prices: Record<MarketSlug, ParsedMarketPrice>,
  /** If true, this is a partial update that should be merged, not replaced */
  isPartial?: boolean,
) => void;
type MarketInfoCallback = (info: Record<MarketSlug, ParsedMarketInfo>) => void;
type StatusCallback = (status: ApiConnectionStatus) => void;

let onPriceUpdate: PriceUpdateCallback | null = null;
let onMarketInfoUpdate: MarketInfoCallback | null = null;
let onStatusChange: StatusCallback | null = null;

// ─── Public API ───────────────────────────────────────────

/**
 * Start the price service (GMX polling only).
 */
export function startPriceService(callbacks: {
  onPriceUpdate: PriceUpdateCallback;
  onMarketInfoUpdate: MarketInfoCallback;
  onStatusChange: StatusCallback;
}): () => void {
  onPriceUpdate = callbacks.onPriceUpdate;
  onMarketInfoUpdate = callbacks.onMarketInfoUpdate;
  onStatusChange = callbacks.onStatusChange;

  consumerCount++;
  console.info(`[PriceService] Consumer connected (${consumerCount} active)`);

  if (consumerCount === 1 && !isServiceRunning) {
    isServiceRunning = true;
    console.info("[PriceService] Starting (GMX only)...");

    pollPrices();
    pollMarketInfo();

    priceIntervalId = setInterval(pollPrices, PRICE_POLL_INTERVAL_MS);
    marketInfoIntervalId = setInterval(
      pollMarketInfo,
      MARKET_INFO_POLL_INTERVAL_MS,
    );
  }

  return () => {
    consumerCount--;
    console.info(
      `[PriceService] Consumer disconnected (${consumerCount} remaining)`,
    );

    if (consumerCount <= 0) {
      consumerCount = 0;
      stopPriceService();
    }
  };
}

function stopPriceService(): void {
  console.info("[PriceService] Stopping...");

  if (priceIntervalId) {
    clearInterval(priceIntervalId);
    priceIntervalId = null;
  }

  if (marketInfoIntervalId) {
    clearInterval(marketInfoIntervalId);
    marketInfoIntervalId = null;
  }

  isServiceRunning = false;
  isPolling = false;
  lastSuccessfulGmxFetch = 0;
  gmxOutageStartedAt = null;
  onPriceUpdate = null;
  onMarketInfoUpdate = null;
  onStatusChange = null;
}

/**
 * Oracle connection status derived only from successful GMX price polls.
 */
export function getConnectionStatus(): ApiConnectionStatus {
  const apiStatus = getApiStatus();
  const timeSinceLastSuccess = Date.now() - lastSuccessfulGmxFetch;

  const hasRecentGmxPrices =
    lastSuccessfulGmxFetch > 0 &&
    timeSinceLastSuccess < STALE_ORACLE_THRESHOLD_MS;

  if (apiStatus.isAvailable && hasRecentGmxPrices) {
    return "connected";
  }

  if (apiStatus.isAvailable && lastSuccessfulGmxFetch > 0) {
    return "degraded";
  }

  if (apiStatus.isAvailable && gmxOutageStartedAt !== null) {
    return "degraded";
  }

  return "disconnected";
}

// ─── Internal Polling ─────────────────────────────────────

async function pollPrices(): Promise<void> {
  if (isPolling) return;
  isPolling = true;

  try {
    const prices = await fetchMarketPrices();
    lastSuccessfulGmxFetch = Date.now();
    gmxOutageStartedAt = null;

    onPriceUpdate?.(prices);
    onStatusChange?.(getConnectionStatus());
  } catch (error) {
    console.warn("[PriceService] GMX price fetch failed:", error);

    const now = Date.now();
    if (gmxOutageStartedAt === null) {
      gmxOutageStartedAt =
        lastSuccessfulGmxFetch > 0 ? lastSuccessfulGmxFetch : now;
    }

    onStatusChange?.(getConnectionStatus());
  } finally {
    isPolling = false;
  }
}

async function pollMarketInfo(): Promise<void> {
  try {
    const info = await fetchMarketInfo();
    onMarketInfoUpdate?.(info);
  } catch (error) {
    console.warn("[PriceService] GMX market info fetch failed:", error);
  }
}
