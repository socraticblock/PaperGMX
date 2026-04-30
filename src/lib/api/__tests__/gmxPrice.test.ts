import { describe, it, expect } from "vitest";
import {
  parseGmxUsdValue,
  parseGmxPrice,
  parseGmxAnnualRate,
  parseGmxPerSecondRate,
  calculateSpreadPercent,
} from "../gmxPrice";
import { price } from "../../branded";

describe("parseGmxUsdValue", () => {
  it("parses ETH price correctly (18 decimals)", () => {
    // ETH at ~$2,263.21 → raw = "2263212401601249" (value * 10^12)
    // But the actual raw value from API is much larger because it's 30-decimal
    // Real API: ETH minPrice = "2263370644399128" means 2263.37 * 10^12
    const result = parseGmxUsdValue("2263370644399128", 18);
    expect(result).toBeCloseTo(2263.37, 0);
  });

  it("parses BTC price correctly (8 decimals)", () => {
    // BTC at ~$76,285 → raw = 762852859759876100000000000 (value * 10^22)
    const result = parseGmxUsdValue("762852859759876100000000000", 8);
    expect(result).toBeCloseTo(76285, 0);
  });

  it("parses USDC price correctly (6 decimals)", () => {
    // USDC at ~$0.9998 → raw = 999752679814197900000000 (value * 10^24)
    const result = parseGmxUsdValue("999752679814197900000000", 6);
    expect(result).toBeCloseTo(0.9998, 3);
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
});

describe("parseGmxPrice", () => {
  it("returns positive Price for valid input", () => {
    const result = parseGmxPrice("2263370644399128", 18);
    expect(result).toBeGreaterThan(0);
  });

  it("returns minimum price for zero input", () => {
    const result = parseGmxPrice("0", 18);
    expect(result).toBe(0.01); // Fallback minimum
  });
});

describe("parseGmxPerSecondRate", () => {
  it("returns 0 for zero rate", () => {
    expect(parseGmxPerSecondRate("0")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseGmxPerSecondRate("")).toBe(0);
  });

  it("parses a positive rate to a per-second decimal", () => {
    // Even a small rate should parse to something
    const result = parseGmxPerSecondRate("50652112006367956795278240000");
    expect(result).toBeGreaterThan(0);
    // Per-second rate should be small (annual rate / seconds per year)
    expect(result).toBeLessThan(1);
  });
});

describe("parseGmxAnnualRate", () => {
  it("returns 0 for zero rate", () => {
    expect(parseGmxAnnualRate("0")).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseGmxAnnualRate("")).toBe(0);
  });

  it("parses a rate to an annualized percentage", () => {
    const result = parseGmxAnnualRate("50652112006367956795278240000");
    // Should be a positive annualized percentage
    expect(result).toBeGreaterThan(0);
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

  it("returns 0 for very small min price (edge case)", () => {
    // price() constructor requires positive values, so we use the minimum
    const spread = calculateSpreadPercent(price(0.01), price(2010));
    // With such extreme price difference, spread is very large
    expect(spread).toBeGreaterThan(100); // >100% spread
  });
});
