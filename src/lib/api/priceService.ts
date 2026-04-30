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
import type { ParsedMarketPrice, ParsedMarketInfo, ApiConnectionStatus } from "./types";
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
let isBinanceActive = false;
let isServiceRunning = false; // Singleton guard
let isPolling = false; // Prevent overlapping polls

type PriceUpdateCallback = (prices: Record<MarketSlug, ParsedMarketPrice>) => void;
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
 * SINGLETON: Only one instance can run at a time.
 * Calling startPriceService while already running is a no-op
 * but updates the callbacks to the latest caller.
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

  // Singleton guard — prevent duplicate intervals
  if (isServiceRunning) {
    console.info("[PriceService] Already running, updating callbacks");
    return stopPriceService;
  }

  isServiceRunning = true;
  console.info("[PriceService] Starting...");

  // Initialize timestamp to now (not 0) to prevent "degraded" flash on cold start
  if (lastSuccessfulGmxFetch === 0) {
    lastSuccessfulGmxFetch = Date.now();
  }

  // Initial fetch immediately
  pollPrices();
  pollMarketInfo();

  // Set up polling intervals
  priceIntervalId = setInterval(pollPrices, PRICE_POLL_INTERVAL_MS);
  marketInfoIntervalId = setInterval(pollMarketInfo, MARKET_INFO_POLL_INTERVAL_MS);

  // Return cleanup function
  return stopPriceService;
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

  if (apiStatus.isAvailable && timeSinceLastSuccess < FALLBACK_ACTIVATION_DELAY_MS) {
    return "connected";
  }

  if (apiStatus.isAvailable && timeSinceLastSuccess >= FALLBACK_ACTIVATION_DELAY_MS) {
    return "degraded";
  }

  if (isBinanceActive && isBinanceConnected()) {
    return "fallback";
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

    // If Binance was active and GMX is back, deactivate Binance
    if (isBinanceActive) {
      console.info("[PriceService] GMX API recovered, deactivating Binance fallback");
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
    const timeSinceLastSuccess = Date.now() - lastSuccessfulGmxFetch;
    if (timeSinceLastSuccess >= FALLBACK_ACTIVATION_DELAY_MS && !isBinanceActive) {
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
    onPriceUpdate?.(prices);
    onStatusChange?.(getConnectionStatus());
  });
}
