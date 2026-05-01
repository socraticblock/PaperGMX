/**
 * Binance WebSocket Fallback
 *
 * When the GMX API is unavailable for >30 seconds, we fall back to
 * Binance's free WebSocket for price data. This ensures users always
 * see live prices even during GMX API outages.
 *
 * Key differences from GMX prices:
 * - Binance gives a single mid-price, not min/max spread
 * - We simulate the spread as ±0.05% to maintain oracle behavior
 * - A "Using Binance data" banner is shown to users
 */

import type { MarketSlug } from "@/types";
import type { ParsedMarketPrice } from "./types";

// ─── Binance Symbol Mapping ───────────────────────────────

const BINANCE_SYMBOLS: Record<MarketSlug, string> = {
  eth: "ethusdt",
  btc: "btcusdt",
  sol: "solusdt",
  arb: "arbusdt",
};

const SPREAD_SIMULATION_BPS = 5; // 0.05% simulated spread

// ─── WebSocket Connection ─────────────────────────────────

type PriceCallback = (prices: Record<MarketSlug, ParsedMarketPrice>) => void;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let priceCallback: PriceCallback | null = null;
let lastPrices: Record<string, number> = {};
let isConnected = false;

/**
 * Connect to Binance combined stream WebSocket.
 * Subscribes to miniTicker for all 4 markets.
 */
export function connectBinanceWs(callback: PriceCallback): () => void {
  priceCallback = callback;

  const streams = Object.values(BINANCE_SYMBOLS)
    .map((s) => `${s}@miniTicker`)
    .join("/");

  const url = `wss://stream.binance.com:9443/ws/${streams}`;

  function connect() {
    // Close any existing WebSocket before creating a new one
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
    }

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        isConnected = true;
        // Clear stale prices from previous connection
        lastPrices = {};
        console.info("[BinanceWS] Connected");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleBinanceMessage(data);
        } catch (e) {
          console.warn("[BinanceWS] Failed to parse message:", e);
        }
      };

      ws.onclose = () => {
        isConnected = false;
        console.info("[BinanceWS] Disconnected, reconnecting in 5s...");
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = (error) => {
        console.warn("[BinanceWS] Error:", error);
        ws?.close();
      };
    } catch (e) {
      console.warn("[BinanceWS] Failed to connect:", e);
      reconnectTimer = setTimeout(connect, 5000);
    }
  }

  connect();

  // Return cleanup function
  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null; // Prevent reconnect
      ws.close();
    }
    isConnected = false;
    priceCallback = null;
  };
}

/**
 * Check if Binance WebSocket is currently connected.
 */
export function isBinanceConnected(): boolean {
  return isConnected;
}

// ─── Message Handling ─────────────────────────────────────

function handleBinanceMessage(data: Record<string, unknown>): void {
  // Binance miniTicker format:
  // { "e": "24hrMiniTicker", "s": "ETHUSDT", "c": "2263.21", ... }
  if (data.e !== "24hrMiniTicker" || typeof data.s !== "string") return;

  const symbol = (data.s as string).toLowerCase();
  const closePrice = parseFloat(data.c as string);

  if (!Number.isFinite(closePrice) || closePrice <= 0) return;

  lastPrices[symbol] = closePrice;

  // Convert to our format and notify
  if (priceCallback) {
    const prices = convertBinancePrices(lastPrices);
    priceCallback(prices);
  }
}

/**
 * Convert Binance prices to our ParsedMarketPrice format.
 * Simulates min/max spread from single mid-price.
 */
function convertBinancePrices(
  binancePrices: Record<string, number>,
): Record<MarketSlug, ParsedMarketPrice> {
  const result: Partial<Record<MarketSlug, ParsedMarketPrice>> = {};
  const now = Date.now();

  for (const [slug, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
    const midPrice = binancePrices[binanceSymbol];
    if (!midPrice || !Number.isFinite(midPrice)) continue;

    // Simulate spread: ±0.05% around mid-price
    const spreadMultiplier = SPREAD_SIMULATION_BPS / 10_000;
    const minPrice = midPrice * (1 - spreadMultiplier);
    const maxPrice = midPrice * (1 + spreadMultiplier);

    result[slug as MarketSlug] = {
      marketSlug: slug,
      symbol: slug.toUpperCase(),
      minPrice,
      maxPrice,
      midPrice,
      updatedAt: now,
      isStale: false,
    };
  }

  return result as Record<MarketSlug, ParsedMarketPrice>;
}
