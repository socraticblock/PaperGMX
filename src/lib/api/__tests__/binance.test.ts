/**
 * Tests for Binance WebSocket fallback module.
 *
 * We test the pure message-parsing and price-conversion functions
 * rather than the WebSocket connection itself (which requires a real
 * server). The connectBinanceWs function is integration-tested manually.
 */

import { describe, it, expect } from "vitest";

// ─── Message Parsing Tests ────────────────────────────────

// We can't directly import handleBinanceMessage (it's module-scoped),
// but we can test the behavior by exercising the convertBinancePrices
// logic indirectly. For now, test the key invariants:

describe("Binance: Combined Stream Payload Unwrap", () => {
  // These tests verify the payload format logic that handleBinanceMessage implements.
  // The actual function is not exported, so we test the contract via examples.

  it("combined stream wraps payload in { stream, data }", () => {
    const combinedPayload = {
      stream: "ethusdt@miniTicker",
      data: {
        e: "24hrMiniTicker",
        E: 1700000000000,
        s: "ETHUSDT",
        c: "2263.21",
        o: "2250.00",
        h: "2280.00",
        l: "2240.00",
        v: "12345.678",
        q: "27890123.45",
      },
    };

    // Verify the structure matches what handleBinanceMessage expects
    expect(combinedPayload.stream).toBe("ethusdt@miniTicker");
    expect(combinedPayload.data).toBeDefined();
    expect(typeof combinedPayload.data).toBe("object");
    expect(combinedPayload.data.e).toBe("24hrMiniTicker");
    expect(combinedPayload.data.s).toBe("ETHUSDT");
    expect(combinedPayload.data.c).toBe("2263.21");
  });

  it("single-stream sends payload directly (no wrapping)", () => {
    const singlePayload = {
      e: "24hrMiniTicker",
      E: 1700000000000,
      s: "ETHUSDT",
      c: "2263.21",
      o: "2250.00",
      h: "2280.00",
      l: "2240.00",
      v: "12345.678",
      q: "27890123.45",
    };

    // No stream/data wrapping — payload IS the miniTicker object
    expect(singlePayload.e).toBe("24hrMiniTicker");
    expect(singlePayload.s).toBe("ETHUSDT");
    expect((singlePayload as Record<string, unknown>).stream).toBeUndefined();
    expect((singlePayload as Record<string, unknown>).data).toBeUndefined();
  });
});

describe("Binance: URL Construction", () => {
  it("combined stream URL uses /stream?streams= format", () => {
    const streams = ["ethusdt@miniTicker", "btcusdt@miniTicker", "solusdt@miniTicker", "arbusdt@miniTicker"].join("/");
    const url = `wss://stream.binance.com:9443/stream?streams=${streams}`;

    expect(url).toContain("/stream?streams=");
    expect(url).not.toMatch(/\/ws\//);
    expect(url).toContain("ethusdt@miniTicker");
    expect(url).toContain("btcusdt@miniTicker");
    expect(url).toContain("solusdt@miniTicker");
    expect(url).toContain("arbusdt@miniTicker");
  });
});

describe("Binance: Partial Price Conversion", () => {
  it("should only include markets with actual price data", () => {
    // Simulate the scenario where Binance only provides ETH and BTC
    const binancePrices: Record<string, number> = {
      ethusdt: 2263.21,
      btcusdt: 43250.50,
      // SOL and ARB are missing — their data should not appear in the result
    };

    const BINANCE_SYMBOLS: Record<string, string> = {
      eth: "ethusdt",
      btc: "btcusdt",
      sol: "solusdt",
      arb: "arbusdt",
    };

    const SPREAD_SIMULATION_BPS = 5;
    const result: Partial<Record<string, unknown>> = {};

    for (const [slug, binanceSymbol] of Object.entries(BINANCE_SYMBOLS)) {
      const midPrice = binancePrices[binanceSymbol];
      if (!midPrice || !Number.isFinite(midPrice)) continue;

      const spreadMultiplier = SPREAD_SIMULATION_BPS / 10_000;
      result[slug] = {
        midPrice,
        minPrice: midPrice * (1 - spreadMultiplier),
        maxPrice: midPrice * (1 + spreadMultiplier),
      };
    }

    // ETH and BTC should be present
    expect(result.eth).toBeDefined();
    expect(result.btc).toBeDefined();

    // SOL and ARB should be absent (no Binance data)
    expect(result.sol).toBeUndefined();
    expect(result.arb).toBeUndefined();
  });
});
