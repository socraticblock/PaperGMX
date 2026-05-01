/**
 * GMX Arbitrum API Client
 * 
 * Handles:
 * - Fetching from arbitrum-api.gmxinfra.io
 * - Response validation and parsing
 * - Retry with exponential backoff
 * - Circuit breaker pattern
 * - Stale data detection
 * - Client-side filtering (API doesn't support server-side filtering)
 */

import type {
  GmxTickerResponse,
  GmxMarketInfoResponse,
  ParsedMarketPrice,
  ParsedMarketInfo,
} from "./types";
import { parseGmxPrice, parseGmxUsdValue, parseGmxPerSecondRate, parseGmxAnnualRate } from "./gmxPrice";
import { usd } from "@/lib/branded";
import type { MarketSlug } from "@/types";

// ─── Config ───────────────────────────────────────────────

const API_BASE = "https://arbitrum-api.gmxinfra.io";
const STALE_THRESHOLD_MS = 30_000; // 30 seconds
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const CIRCUIT_BREAKER_FAILURES = 5;
const CIRCUIT_BREAKER_COOLDOWN_MS = 60_000; // 1 minute

// ─── Known Token Addresses & Decimals ─────────────────────
// We hardcode our 4 markets' token info to avoid an extra API call.
// If we add more markets later, we can fetch /tokens dynamically.

const TOKEN_INFO: Record<string, { symbol: string; decimals: number }> = {
  // ETH
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": { symbol: "ETH", decimals: 18 },
  // WBTC.b (wrapped BTC on Arbitrum)
  "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": { symbol: "BTC", decimals: 8 },
  // Also BTC index token variant
  "0x47904963fc8b2340414262125af798b9655e58cd": { symbol: "BTC", decimals: 8 },
  // SOL
  "0x2bc4c7194e13c0d46d3f4e6dd567d31fa2cabc34": { symbol: "SOL", decimals: 9 },
  // ARB
  "0x912ce59144191c1204e64559fe8253a0e49e6548": { symbol: "ARB", decimals: 18 },
  // USDC
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": { symbol: "USDC", decimals: 6 },
};

// Market index token addresses (the token whose price we track)
const MARKET_INDEX_TOKENS: Record<MarketSlug, string> = {
  eth: "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
  btc: "0x47904963fc8b2340414262125af798b9655e58cd",
  sol: "0x2bc4c7194e13c0d46d3f4e6dd567d31fa2cabc34",
  arb: "0x912ce59144191c1204e64559fe8253a0e49e6548",
};

// Market contract addresses (for matching in /markets/info)
const MARKET_CONTRACTS: Record<string, MarketSlug> = {
  // ETH/USD market
  "0x70d95587d40a2caf56bd97485af3f73a4a4cf3b0": "eth",
  // BTC/USD market
  "0x47c031236e19d024b42f8ae6780e44a573170703": "btc",
  // SOL/USD market
  "0xf7bF0b742E7A4e63E4B6882B0997CD6cd2405029": "sol",
  // ARB/USD market
  "0x6d75Bc5e7BD71d5D2e4E25C785BcE7D7d0d08044": "arb",
};

// ─── Circuit Breaker State ────────────────────────────────

let consecutiveFailures = 0;
let circuitOpenUntil = 0;

function isCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

function recordSuccess(): void {
  consecutiveFailures = 0;
}

function recordFailure(): void {
  consecutiveFailures++;
  if (consecutiveFailures >= CIRCUIT_BREAKER_FAILURES) {
    circuitOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
    console.warn(
      `[GmxApi] Circuit breaker opened after ${consecutiveFailures} failures. Cooldown: ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s`
    );
  }
}

// ─── Fetch with Retry ─────────────────────────────────────

async function fetchWithRetry(url: string): Promise<Response> {
  if (isCircuitOpen()) {
    throw new Error(`[GmxApi] Circuit breaker is open. Retry after ${new Date(circuitOpenUntil).toISOString()}`);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    try {
      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      recordSuccess();
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < MAX_RETRIES - 1) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.warn(`[GmxApi] Attempt ${attempt + 1} failed, retrying in ${delay}ms...`, lastError.message);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  recordFailure();
  throw lastError ?? new Error("All retry attempts failed");
}

// ─── Response Validation ──────────────────────────────────

function validateTicker(raw: unknown): GmxTickerResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.tokenAddress !== "string") return null;
  if (typeof obj.tokenSymbol !== "string") return null;
  if (typeof obj.minPrice !== "string") return null;
  if (typeof obj.maxPrice !== "string") return null;

  // Validate that minPrice and maxPrice are valid numeric strings
  try {
    BigInt(obj.minPrice);
    BigInt(obj.maxPrice);
  } catch {
    return null;
  }

  return {
    tokenAddress: obj.tokenAddress,
    tokenSymbol: obj.tokenSymbol,
    minPrice: obj.minPrice,
    maxPrice: obj.maxPrice,
    updatedAt: typeof obj.updatedAt === "number" ? obj.updatedAt : Date.now(),
    timestamp: typeof obj.timestamp === "number" ? obj.timestamp : Math.floor(Date.now() / 1000),
  };
}

function validateMarketInfo(raw: unknown): GmxMarketInfoResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.marketToken !== "string") return null;
  if (typeof obj.name !== "string") return null;
  if (typeof obj.indexToken !== "string") return null;
  if (typeof obj.isListed !== "boolean") return null;

  // All rate/OI fields should be strings
  const stringFields = [
    "openInterestLong", "openInterestShort",
    "fundingRateLong", "fundingRateShort",
    "borrowingRateLong", "borrowingRateShort",
  ];

  for (const field of stringFields) {
    if (obj[field] !== undefined && typeof obj[field] !== "string") return null;
  }

  return obj as unknown as GmxMarketInfoResponse;
}

// ─── Public API ───────────────────────────────────────────

/**
 * Fetch and parse prices for our 4 markets.
 * Returns a Record<MarketSlug, ParsedMarketPrice>.
 */
export async function fetchMarketPrices(): Promise<Record<MarketSlug, ParsedMarketPrice>> {
  const response = await fetchWithRetry(`${API_BASE}/prices/tickers`);
  const rawData: unknown[] = await response.json();

  if (!Array.isArray(rawData)) {
    throw new Error("[GmxApi] /prices/tickers returned non-array");
  }

  // Build a map of tokenAddress → GmxTickerResponse for our markets
  const tickerMap = new Map<string, GmxTickerResponse>();

  for (const item of rawData) {
    const validated = validateTicker(item);
    if (!validated) continue;

    // Only keep tickers for our 4 markets
    const address = validated.tokenAddress.toLowerCase();
    if (TOKEN_INFO[address]) {
      tickerMap.set(address, validated);
    }
  }

  // Parse prices for each market
  const result: Partial<Record<MarketSlug, ParsedMarketPrice>> = {};

  for (const [slug, indexTokenAddress] of Object.entries(MARKET_INDEX_TOKENS)) {
    const ticker = tickerMap.get(indexTokenAddress.toLowerCase());
    const tokenInfo = TOKEN_INFO[indexTokenAddress.toLowerCase()];

    if (!ticker || !tokenInfo) continue;

    const minP = parseGmxPrice(ticker.minPrice, tokenInfo.decimals);
    const maxP = parseGmxPrice(ticker.maxPrice, tokenInfo.decimals);
    const midP = (minP + maxP) / 2;
    const age = Date.now() - ticker.updatedAt;

    result[slug as MarketSlug] = {
      marketSlug: slug,
      symbol: tokenInfo.symbol,
      minPrice: minP,
      maxPrice: maxP,
      midPrice: Number.isFinite(midP) ? midP : minP,
      updatedAt: ticker.updatedAt,
      isStale: age > STALE_THRESHOLD_MS,
    };
  }

  // Runtime validation: warn if BTC price is missing while other markets have data
  // This catches address mismatches between our hardcoded TOKEN_INFO and the live API
  const fetchedSlugs = Object.keys(result);
  if (
    fetchedSlugs.includes("eth") &&
    fetchedSlugs.includes("sol") &&
    !fetchedSlugs.includes("btc")
  ) {
    console.warn(
      `[GmxApi] BTC price missing while ETH/SOL fetched. ` +
      `Check BTC index token address: ${MARKET_INDEX_TOKENS.btc}. ` +
      `Verify against /prices/tickers response field tokenAddress.`
    );
  }

  return result as Record<MarketSlug, ParsedMarketPrice>;
}

/**
 * Fetch and parse market info for our 4 markets.
 * Returns a Record<MarketSlug, ParsedMarketInfo>.
 * 
 * Note: This endpoint is SLOW (~5-10s). Call it less frequently than prices.
 */
export async function fetchMarketInfo(): Promise<Record<MarketSlug, ParsedMarketInfo>> {
  const response = await fetchWithRetry(`${API_BASE}/markets/info`);
  const rawBody = await response.json();
  const rawData: unknown[] = rawBody?.markets ?? rawBody;

  if (!Array.isArray(rawData)) {
    throw new Error("[GmxApi] /markets/info returned non-array");
  }

  const result: Partial<Record<MarketSlug, ParsedMarketInfo>> = {};

  for (const item of rawData) {
    const validated = validateMarketInfo(item);
    if (!validated) continue;
    if (!validated.isListed) continue;

    // Match to our markets by market contract address
    const slug = MARKET_CONTRACTS[validated.marketToken.toLowerCase()];
    if (!slug) continue;

    const longOi = parseGmxUsdValue(validated.openInterestLong, 30);
    const shortOi = parseGmxUsdValue(validated.openInterestShort, 30);

    // Parse rates as per-second values for our calculation functions
    const borrowRateLong = parseGmxPerSecondRate(validated.borrowingRateLong);
    const borrowRateShort = parseGmxPerSecondRate(validated.borrowingRateShort);
    const fundingRate = parseGmxPerSecondRate(validated.fundingRateLong);

    // Annualized rates for display — uses parseGmxAnnualRate for
    // precise conversion from raw 30-decimal API strings
    const borrowRateLongAnnualized = parseGmxAnnualRate(validated.borrowingRateLong);
    const borrowRateShortAnnualized = parseGmxAnnualRate(validated.borrowingRateShort);
    const fundingRateAnnualized = parseGmxAnnualRate(validated.fundingRateLong);

    // Determine position fee BPS based on OI balance
    // Conservative default: 6 BPS (imbalancing fee)
    // TODO: Actual fee determined at execution time based on OI balance
    const positionFeeBps = 6;

    result[slug] = {
      marketSlug: slug,
      name: validated.name,
      indexToken: validated.indexToken,
      longOiUsd: longOi,
      shortOiUsd: shortOi,
      totalOiUsd: usd(longOi + shortOi),
      borrowRateLongPerSecond: borrowRateLong,
      borrowRateShortPerSecond: borrowRateShort,
      borrowRateLongAnnualized,
      borrowRateShortAnnualized,
      fundingRatePerSecond: fundingRate,
      fundingRateAnnualized,
      positionFeeBps,
    };
  }

  return result as Record<MarketSlug, ParsedMarketInfo>;
}

/**
 * Get the current circuit breaker status.
 */
export function getApiStatus(): { isAvailable: boolean; failures: number; cooldownRemaining: number } {
  return {
    isAvailable: !isCircuitOpen(),
    failures: consecutiveFailures,
    cooldownRemaining: Math.max(0, circuitOpenUntil - Date.now()),
  };
}

/**
 * Reset the circuit breaker (for testing or manual recovery).
 */
export function resetCircuitBreaker(): void {
  consecutiveFailures = 0;
  circuitOpenUntil = 0;
}
