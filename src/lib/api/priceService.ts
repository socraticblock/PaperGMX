/**
 * Unified Price Service
 *
 * Orchestrates price data from two sources:
 * 1. GMX Oracle Keeper API (primary) — provides min/max oracle prices
 * 2. Binance WebSocket (fallback) — provides mid-price when GMX is down
 *
 * Architecture:
 * - GMX API is polled every 3 seconds (same as GMX's own frontend)
 * - If GMX API fails for 30+ seconds, Binance WebSocket activates
 * - When GMX API recovers, Binance is deactivated
 * - All prices go through Zustand store for global access
 * - Components subscribe to the store, never to the API directly
 *
 * Circuit breaker:
 * - After 5 consecutive GMX API failures, circuit opens for 60 seconds
 * - During circuit open, Binance is the sole source
 * - After cooldown, GMX is retried automatically
 *
 * Singleton guard:
 * - Only one price service can run at a time across the entire app
 * - Prevents duplicate intervals on React StrictMode or page transitions
 */

import type { MarketSlug } from "@/types";
import type {
  ParsedMarketPrice,
  ParsedMarketInfo,
  ApiConnectionStatus,
} from "./types";
import { fetchMarketPrices, fetchMarketInfo, getApiStatus } from "./gmx";
import { connectBinanceWs, isBinanceConnected } from "./binance";

// ─── Config ───────────────────────────────────────────────

const PRICE_POLL_INTERVAL_MS = 3_000;
const MARKET_INFO_POLL_INTERVAL_MS = 30_000; // Less frequent (slow endpoint)
const FALLBACK_ACTIVATION_DELAY_MS = 30_000;

// ─── State ────────────────────────────────────────────────

let priceIntervalId: ReturnType<typeof setInterval> | null = null;
let marketInfoIntervalId: ReturnType<typeof setInterval> | null = null;
let binanceCleanup: (() => void) | null = null;

let lastSuccessfulGmxFetch = 0;
let gmxOutageStartedAt: number | null = null;
let isBinanceActive = false;
let isServiceRunning = false; // Singleton guard
let isPolling = false; // Prevent overlapping polls
let consumerCount = 0; // Reference counting for lifecycle management

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
 * Start the price service.
 * Begins polling GMX API and sets up Binance fallback.
 *
 * REFERENCE COUNTING: Multiple consumers can call startPriceService.
 * The service only starts when the first consumer connects, and only
 * stops when the last consumer disconnects. This prevents the service
 * from being killed during page transitions where the new page mounts
 * before the old one unmounts.
 */
export function startPriceService(callbacks: {
  onPriceUpdate: PriceUpdateCallback;
  onMarketInfoUpdate: MarketInfoCallback;
  onStatusChange: StatusCallback;
}): () => void {
  // Update callbacks even if already running (page transitions)
  onPriceUpdate = callbacks.onPriceUpdate;
  onMarketInfoUpdate = callbacks.onMarketInfoUpdate;
  onStatusChange = callbacks.onStatusChange;

  consumerCount++;
  console.info(`[PriceService] Consumer connected (${consumerCount} active)`);

  // Start the service only when the first consumer connects
  if (consumerCount === 1 && !isServiceRunning) {
    isServiceRunning = true;
    console.info("[PriceService] Starting...");

    // Initial fetch immediately
    pollPrices();
    pollMarketInfo();

    // Set up polling intervals
    priceIntervalId = setInterval(pollPrices, PRICE_POLL_INTERVAL_MS);
    marketInfoIntervalId = setInterval(
      pollMarketInfo,
      MARKET_INFO_POLL_INTERVAL_MS,
    );
  }

  // Return cleanup function that decrements consumer count
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

/**
 * Stop the price service and clean up all resources.
 */
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

  if (binanceCleanup) {
    binanceCleanup();
    binanceCleanup = null;
  }

  isBinanceActive = false;
  isServiceRunning = false;
  isPolling = false;
  // Reset timing state so a restarted service doesn't report stale
  // "connected" status based on a previous session's successful fetch.
  lastSuccessfulGmxFetch = 0;
  gmxOutageStartedAt = null;
  onPriceUpdate = null;
  onMarketInfoUpdate = null;
  onStatusChange = null;
}

/**
 * Get current connection status.
 */
export function getConnectionStatus(): ApiConnectionStatus {
  const apiStatus = getApiStatus();
  const timeSinceLastSuccess = Date.now() - lastSuccessfulGmxFetch;

  // Only report "connected" or "degraded" if we've actually received data
  // from GMX recently. The API endpoint being "available" (responding) is
  // not sufficient — we need to have successfully parsed price data.
  const hasRecentGmxData = lastSuccessfulGmxFetch > 0 && timeSinceLastSuccess < FALLBACK_ACTIVATION_DELAY_MS;

  if (isBinanceActive && isBinanceConnected()) {
    return "fallback";
  }

  if (apiStatus.isAvailable && hasRecentGmxData) {
    return "connected";
  }

  if (
    apiStatus.isAvailable &&
    lastSuccessfulGmxFetch > 0 &&
    timeSinceLastSuccess >= FALLBACK_ACTIVATION_DELAY_MS
  ) {
    return "degraded";
  }

  if (apiStatus.isAvailable && gmxOutageStartedAt !== null) {
    return "degraded";
  }

  return "disconnected";
}

// ─── Internal Polling ─────────────────────────────────────

async function pollPrices(): Promise<void> {
  // Prevent overlapping requests during slow API
  if (isPolling) return;
  isPolling = true;

  try {
    const prices = await fetchMarketPrices();
    lastSuccessfulGmxFetch = Date.now();
    gmxOutageStartedAt = null;

    // If Binance was active and GMX is back, deactivate Binance
    if (isBinanceActive) {
      console.info(
        "[PriceService] GMX API recovered, deactivating Binance fallback",
      );
      if (binanceCleanup) {
        binanceCleanup();
        binanceCleanup = null;
      }
      isBinanceActive = false;
    }

    onPriceUpdate?.(prices);
    onStatusChange?.(getConnectionStatus());
  } catch (error) {
    console.warn("[PriceService] GMX price fetch failed:", error);

    // Check if we should activate Binance fallback
    const now = Date.now();
    if (gmxOutageStartedAt === null) {
      gmxOutageStartedAt =
        lastSuccessfulGmxFetch > 0 ? lastSuccessfulGmxFetch : now;
    }
    const outageDuration = now - gmxOutageStartedAt;
    if (
      outageDuration >= FALLBACK_ACTIVATION_DELAY_MS &&
      !isBinanceActive
    ) {
      activateBinanceFallback();
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
    // Market info is less critical — don't activate fallback for this
  }
}

function activateBinanceFallback(): void {
  if (isBinanceActive) return;

  console.info("[PriceService] Activating Binance WebSocket fallback");
  isBinanceActive = true;

  binanceCleanup = connectBinanceWs((prices) => {
    onPriceUpdate?.(prices as Record<MarketSlug, ParsedMarketPrice>, true);
    onStatusChange?.(getConnectionStatus());
  });
}
