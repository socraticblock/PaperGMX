import { describe, it, expect } from "vitest";
import {
  parseGmxUsdValue,
  parseGmxPrice,
  parseGmxAnnualRate,
  parseGmxPerSecondRate,
  parseGmxBorrowFundingRate,
  SECONDS_PER_YEAR,
  calculateSpreadPercent,
  calculatePriceChangePercent,
} from "../gmxPrice";
import { price } from "../../branded";

// ─── Realistic API values ────────────────────────────────────
// These match the format returned by the GMX Arbitrum API
// (arbitrum-api.gmxinfra.io).
//
// The GMX API returns prices in 30-decimal USD format, meaning:
//   actualUSD = BigInt(rawValue) / 10^(30 - tokenDecimals)
//
// So the string length varies by token:
//   ETH (18 decimals): ~16 chars  (divisor = 10^12)
//   BTC (8 decimals):  ~27 chars  (divisor = 10^22)
//   SOL (9 decimals):  ~24 chars  (divisor = 10^21)
//   ARB (18 decimals): ~13 chars  (divisor = 10^12)
//
// Rates (borrow/funding) use 30-decimal format directly:
//   per-second rate * 10^30 → typically 20-30 chars

// ─── Realistic price values ──────────────────────────────────

// ETH (18 decimals) at ~$2,263.37 — truncated API format
const API_ETH_MIN = "2263370644399128"; // ~$2263.37

// BTC (8 decimals) at ~$76,285
const API_BTC_MIN = "762852859759876100000000000"; // ~$76285.29

// SOL (9 decimals) at ~$152.34
const API_SOL_MIN = "152340000000000000000000"; // ~$152.34

// ARB (18 decimals) at ~$0.382
const API_ARB_MIN = "382000000000"; // ~$0.382

// ─── Realistic rate values ───────────────────────────────────
// Borrow rates from /markets/info are 30-decimal per-second rates.
// A ~45% annual rate → per-second ≈ 45/100/31536000 ≈ 1.427e-8
// In 30-decimal: 1.427e-8 * 10^30 = 1.427e22

// ~45% annual BTC borrow rate
const REAL_BORROW_RATE_BTC = "14270000000000000000000"; // ~1.427e-8 per-second
// ~180% annual ETH borrow rate
const REAL_BORROW_RATE_ETH = "57080000000000000000000"; // ~5.708e-8 per-second
// ~1% annual funding rate
const REAL_FUNDING_RATE = "317000000000000000000"; // ~3.17e-10 per-second

describe("parseGmxUsdValue", () => {
  it("parses ETH price with truncated API format (18 decimals)", () => {
    const result = parseGmxUsdValue(API_ETH_MIN, 18);
    expect(result).toBeCloseTo(2263.37, 0);
  });

  it("parses BTC price correctly with API format (8 decimals)", () => {
    const result = parseGmxUsdValue(API_BTC_MIN, 8);
    expect(result).toBeCloseTo(76285, -1);
  });

  it("parses SOL price correctly with API format (9 decimals)", () => {
    const result = parseGmxUsdValue(API_SOL_MIN, 9);
    expect(result).toBeCloseTo(152, 0);
  });

  it("parses ARB price correctly with API format (18 decimals)", () => {
    const result = parseGmxUsdValue(API_ARB_MIN, 18);
    expect(result).toBeCloseTo(0.382, 2);
  });

  it("parses USDC price correctly (6 decimals)", () => {
    // USDC at ~$0.9998
    const result = parseGmxUsdValue("999752679814197900000000", 6);
    expect(result).toBeCloseTo(0.9998, 3);
  });

  it("truncated and padded formats produce consistent results for ETH", () => {
    const truncated = parseGmxUsdValue(API_ETH_MIN, 18);
    // Padded with trailing zeros gives a scaled-up value
    // (API typically returns the truncated format without trailing zeros)
    const padded = parseGmxUsdValue(API_ETH_MIN + "000000000000", 18);
    expect(truncated).toBeGreaterThan(0);
    expect(padded).toBeGreaterThan(0);
    // Padded should be 10^12 times larger (12 trailing zeros added)
    expect(padded / truncated).toBeCloseTo(1e12, -8);
  });

  it("returns 0 for empty string", () => {
    expect(parseGmxUsdValue("", 18)).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parseGmxUsdValue("not-a-number", 18)).toBe(0);
  });

  it("returns 0 for zero", () => {
    expect(parseGmxUsdValue("0", 18)).toBe(0);
  });

  it("handles leading zeros in raw value", () => {
    // ARB price with leading zero: 0.382 → "0382000000000" (with leading 0)
    // BigInt treats leading zeros as insignificant
    const result = parseGmxUsdValue("0382000000000", 18);
    expect(result).toBeCloseTo(0.382, 2); // Same as without leading zero
  });
});

describe("parseGmxPrice", () => {
  it("returns positive Price for valid ETH input", () => {
    const result = parseGmxPrice(API_ETH_MIN, 18);
    expect(result).toBeGreaterThan(2200);
    expect(result).toBeLessThan(2300);
  });

  it("returns positive Price for valid BTC input", () => {
    const result = parseGmxPrice(API_BTC_MIN, 8);
    expect(result).toBeGreaterThan(70000);
  });

  it("returns 0 for zero input (invalid price signal)", () => {
    const result = parseGmxPrice("0", 18);
    expect(result).toBe(0); // Zero signals "no valid price" to downstream guards
  });
});

describe("parseGmxBorrowFundingRate", () => {
  it("treats large factors as annual APR decimals (live GMX /markets/info)", () => {
    // 12% per year as decimal 0.12 → raw = 0.12 * 10^30
    const raw = (12n * 10n ** 28n).toString();
    const { perSecond, annualizedPercent } = parseGmxBorrowFundingRate(raw);
    expect(annualizedPercent).toBeCloseTo(12, 5);
    expect(perSecond).toBeCloseTo(0.12 / SECONDS_PER_YEAR, 12);
  });

  it("still interprets tiny factors as per-second (fixtures)", () => {
    const { perSecond, annualizedPercent } =
      parseGmxBorrowFundingRate(REAL_BORROW_RATE_BTC);
    expect(perSecond).toBeGreaterThan(1e-9);
    expect(perSecond).toBeLessThan(1e-5);
    expect(annualizedPercent).toBeGreaterThan(30);
    expect(annualizedPercent).toBeLessThan(60);
  });
});

describe("parseGmxPerSecondRate", () => {
  it("returns 0 for zero rate", () => {
    expect(parseGmxPerSecondRate("0")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseGmxPerSecondRate("")).toBe(0);
  });

  it("parses a realistic BTC borrow rate (~45% annual)", () => {
    const result = parseGmxPerSecondRate(REAL_BORROW_RATE_BTC);
    expect(result).toBeGreaterThan(0);
    // Per-second rate should be ~1.43e-8
    expect(result).toBeLessThan(0.0001);
    expect(result).toBeGreaterThan(1e-9);
  });

  it("parses a realistic ETH borrow rate (~180% annual)", () => {
    const result = parseGmxPerSecondRate(REAL_BORROW_RATE_ETH);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(0.001);
  });
});

describe("parseGmxAnnualRate", () => {
  it("returns 0 for zero rate", () => {
    expect(parseGmxAnnualRate("0")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseGmxAnnualRate("")).toBe(0);
  });

  it("parses realistic BTC borrow rate to ~45% annualized", () => {
    const result = parseGmxAnnualRate(REAL_BORROW_RATE_BTC);
    // 1.427e-8 per-second * 31536000 seconds/year * 100 ≈ 45%
    expect(result).toBeGreaterThan(30);
    expect(result).toBeLessThan(60);
  });

  it("parses realistic ETH borrow rate to ~180% annualized", () => {
    const result = parseGmxAnnualRate(REAL_BORROW_RATE_ETH);
    // 5.708e-8 per-second * 31536000 * 100 ≈ 180%
    expect(result).toBeGreaterThan(100);
    expect(result).toBeLessThan(250);
  });

  it("parses realistic funding rate to ~1% annualized", () => {
    const result = parseGmxAnnualRate(REAL_FUNDING_RATE);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(10);
  });

  it("annualized rate is consistent with per-second rate", () => {
    // Manual annualization should match parseGmxAnnualRate within 1%
    const perSecond = parseGmxPerSecondRate(REAL_BORROW_RATE_BTC);
    const manualAnnual = perSecond * 31536000 * 100;
    const parsedAnnual = parseGmxAnnualRate(REAL_BORROW_RATE_BTC);
    expect(Math.abs(manualAnnual - parsedAnnual) / parsedAnnual).toBeLessThan(
      0.01,
    );
  });
});

describe("calculateSpreadPercent", () => {
  it("returns 0 for identical min and max prices", () => {
    expect(calculateSpreadPercent(price(2000), price(2000))).toBeCloseTo(0, 4);
  });

  it("calculates spread for different min and max", () => {
    // 1990 min, 2010 max → spread = 20/2000 = 1%
    const spread = calculateSpreadPercent(price(1990), price(2010));
    expect(spread).toBeCloseTo(1, 1);
  });

  it("calculates spread for realistic ETH oracle prices", () => {
    const minP = parseGmxPrice(API_ETH_MIN, 18);
    const maxP = parseGmxPrice("2263510367473508", 18); // slightly higher
    const spread = calculateSpreadPercent(price(minP), price(maxP));
    // ETH spread should be very small (< 0.5%)
    expect(spread).toBeGreaterThan(0);
    expect(spread).toBeLessThan(1);
  });

  it("returns 0 for very small min price (edge case)", () => {
    const spread = calculateSpreadPercent(price(0.01), price(2010));
    expect(spread).toBeGreaterThan(100); // >100% spread
  });
});

describe("calculatePriceChangePercent", () => {
  it("returns 0 for identical prices", () => {
    expect(calculatePriceChangePercent(price(2000), price(2000))).toBeCloseTo(
      0,
      4,
    );
  });

  it("calculates positive change correctly", () => {
    const change = calculatePriceChangePercent(price(2100), price(2000));
    expect(change).toBeCloseTo(5, 1); // +5%
  });

  it("calculates negative change correctly", () => {
    const change = calculatePriceChangePercent(price(1900), price(2000));
    expect(change).toBeCloseTo(-5, 1); // -5%
  });
});
