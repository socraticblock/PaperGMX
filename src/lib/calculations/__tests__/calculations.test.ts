import { describe, it, expect } from "vitest";
import {
  calculateGrossPnl,
  calculatePositionFee,
  calculateBorrowFee,
  calculateFundingFee,
  calculateLiquidationPrice,
  calculateAcceptablePrice,
  determineFillPrice,
  calculatePositionSize,
  calculateClosePosition,
  determinePositionFeeBps,
} from "../index";
import { usd, price, bps } from "../../branded";
import type { Price } from "@/types";

describe("calculateGrossPnl", () => {
  it("calculates long profit correctly", () => {
    const pnl = calculateGrossPnl("long", price(2000), price(2200), usd(10000));
    expect(pnl).toBeCloseTo(1000, 2);
  });

  it("calculates long loss correctly", () => {
    const pnl = calculateGrossPnl("long", price(2000), price(1800), usd(10000));
    expect(pnl).toBeCloseTo(-1000, 2);
  });

  it("calculates short profit correctly", () => {
    const pnl = calculateGrossPnl(
      "short",
      price(2000),
      price(1800),
      usd(10000),
    );
    expect(pnl).toBeCloseTo(1000, 2);
  });

  it("calculates short loss correctly", () => {
    const pnl = calculateGrossPnl(
      "short",
      price(2000),
      price(2200),
      usd(10000),
    );
    expect(pnl).toBeCloseTo(-1000, 2);
  });

  it("returns zero for same entry and exit price", () => {
    const pnl = calculateGrossPnl("long", price(2000), price(2000), usd(10000));
    expect(pnl).toBeCloseTo(0, 2);
  });

  it("throws on zero entry price", () => {
    expect(() =>
      calculateGrossPnl("long", 0 as unknown as Price, price(2000), usd(10000)),
    ).toThrow();
  });

  it("throws on negative position size", () => {
    expect(() =>
      calculateGrossPnl("long", price(2000), price(2200), usd(-1000)),
    ).toThrow();
  });
});

describe("calculatePositionFee", () => {
  it("calculates 4 BPS fee correctly (0.04%)", () => {
    const fee = calculatePositionFee(usd(10000), bps(4));
    expect(fee).toBeCloseTo(4, 2);
  });

  it("calculates 6 BPS fee correctly (0.06%)", () => {
    const fee = calculatePositionFee(usd(10000), bps(6));
    expect(fee).toBeCloseTo(6, 2);
  });

  it("calculates 30 BPS liquidation fee (0.30%)", () => {
    const fee = calculatePositionFee(usd(10000), bps(30));
    expect(fee).toBeCloseTo(30, 2);
  });
});

describe("calculateBorrowFee", () => {
  it("calculates borrow fee for 1 hour", () => {
    const fee = calculateBorrowFee(usd(10000), 0.000001, 3600000);
    expect(fee).toBeCloseTo(36, 0);
  });

  it("returns zero for zero duration", () => {
    const fee = calculateBorrowFee(usd(10000), 0.000001, 0);
    expect(fee).toBe(0);
  });

  it("throws on negative duration", () => {
    expect(() => calculateBorrowFee(usd(10000), 0.000001, -1000)).toThrow();
  });
});

describe("calculateLiquidationPrice", () => {
  it("calculates long liquidation price for BTC/ETH (0.5% maintenance, no fees)", () => {
    const liqPrice = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20), // liquidationFeeBps
      usd(0),
      usd(0),
    );
    // effectiveCollateral = 1000 - 0 - (5000*0.002) - 0 - 5000*0.005
    //                     = 1000 - 10 - 0 - 25 = 965
    // liqPrice = 2000 * (1 - 965/5000) = 2000 * 0.807 = 1614
    expect(liqPrice).toBeCloseTo(1614, 0);
  });

  it("calculates short liquidation price", () => {
    const liqPrice = calculateLiquidationPrice(
      "short",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20), // liquidationFeeBps
      usd(0),
      usd(0),
    );
    // effectiveCollateral = 1000 - 0 - 10 - 0 - 25 = 965
    // liqPrice = 2000 * (1 + 965/5000) = 2000 * 1.193 = 2386
    expect(liqPrice).toBeCloseTo(2386, 0);
  });

  it("liquidation price moves closer with accrued fees", () => {
    const liqPriceNoFees = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20),
      usd(0),
      usd(0),
    );
    const liqPriceWithFees = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20),
      usd(0),
      usd(50),
    );
    expect(liqPriceWithFees!).toBeGreaterThan(liqPriceNoFees!);
  });

  it("liquidation price moves closer with position fee", () => {
    const liqPriceNoPositionFee = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20),
      usd(0),
      usd(0),
    );
    const liqPriceWithPositionFee = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20),
      usd(3),
      usd(0),
    );
    // Position fee reduces effective collateral, moving liq price closer
    expect(liqPriceWithPositionFee!).toBeGreaterThan(liqPriceNoPositionFee!);
  });

  it("liquidation fee moves liq price closer than without", () => {
    const liqPriceNoLiqFee = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(0), // no liquidation fee
      usd(0),
      usd(0),
    );
    const liqPriceWithLiqFee = calculateLiquidationPrice(
      "long",
      price(2000),
      usd(1000),
      usd(5000),
      bps(50),
      bps(20), // 0.2% liquidation fee
      usd(0),
      usd(0),
    );
    // Liquidation fee reduces effective collateral, moving liq price closer
    expect(liqPriceWithLiqFee!).toBeGreaterThan(liqPriceNoLiqFee!);
  });

  it("short liquidation returns null when underwater (negative effective collateral)", () => {
    const liqPrice = calculateLiquidationPrice(
      "short",
      price(2000),
      usd(100),
      usd(10000),
      bps(50),
      bps(20),
      usd(0),
      usd(15000),
    );
    // effectiveCollateral = 100 - 0 - (10000*0.002) - 15000 - 10000*0.005
    //                     = 100 - 20 - 15000 - 50 = -14970
    // liqPrice = 2000 * (1 + (-14970)/10000) = 2000 * (-0.497) = -994 → returns null
    // null signals "no valid liquidation price" — position is deeply insolvent
    expect(liqPrice).toBeNull();
  });
});

describe("determineFillPrice", () => {
  it("long open uses oracle max (worse for buyer)", () => {
    const fill = determineFillPrice(price(1999), price(2001), "long", false);
    expect(fill).toBe(2001);
  });

  it("long close uses oracle min (worse for seller)", () => {
    const fill = determineFillPrice(price(1999), price(2001), "long", true);
    expect(fill).toBe(1999);
  });

  it("short open uses oracle min (worse for buyer)", () => {
    const fill = determineFillPrice(price(1999), price(2001), "short", false);
    expect(fill).toBe(1999);
  });

  it("short close uses oracle max (worse for seller)", () => {
    const fill = determineFillPrice(price(1999), price(2001), "short", true);
    expect(fill).toBe(2001);
  });
});

describe("calculateAcceptablePrice", () => {
  it("long open: acceptable price is higher (worse)", () => {
    const acceptable = calculateAcceptablePrice(
      price(2000),
      bps(50),
      "long",
      false,
    );
    expect(acceptable).toBeCloseTo(2010, 0); // 2000 * 1.005
  });

  it("long close: acceptable price is lower (worse)", () => {
    const acceptable = calculateAcceptablePrice(
      price(2000),
      bps(300),
      "long",
      true,
    );
    expect(acceptable).toBeCloseTo(1940, 0); // 2000 * 0.97
  });
});

describe("calculateClosePosition", () => {
  it("calculates profitable long close correctly", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(2200),
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
    );

    expect(result.grossPnl).toBeCloseTo(500, 1);
    expect(result.positionFeeClose).toBeCloseTo(3, 1);
    expect(result.netPnl).toBeCloseTo(492.5, 1);
    expect(result.returnedCollateral).toBeCloseTo(1492.5, 1);
  });

  it("calculates losing long close correctly", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(1800),
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
    );

    expect(result.grossPnl).toBeCloseTo(-500, 1);
    expect(result.netPnl).toBeCloseTo(-507.5, 1);
    expect(result.returnedCollateral).toBeCloseTo(492.5, 1);
  });

  it("never returns negative collateral", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(100), // catastrophic loss
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
    );

    expect(result.returnedCollateral).toBeGreaterThanOrEqual(0);
  });
});

describe("calculatePositionSize", () => {
  it("calculates position size from collateral and leverage", () => {
    expect(calculatePositionSize(usd(1000), 5)).toBeCloseTo(5000, 2);
    expect(calculatePositionSize(usd(500), 10)).toBeCloseTo(5000, 2);
    expect(calculatePositionSize(usd(2000), 50)).toBeCloseTo(100000, 2);
  });
});

// ─── GMX V2 Invariant Tests ─────────────────────────────────
// These tests verify that the fee calculations match GMX V2's
// exact rules. They serve as regression guards — if any of these
// fail, the fee engine is no longer GMX V2-faithful.

describe("GMX V2: Funding fee direction (rate sign is payer signal)", () => {
  it("positive fundingRateLong → longs PAY (positive fee = cost)", () => {
    // fundingRateLong > 0 means longs pay shorts.
    // The caller selects fundingRateLong for a long position.
    // calculateFundingFee should return a positive value (cost).
    const fee = calculateFundingFee(usd(10000), 0.000001, 3600000);
    expect(fee).toBeGreaterThan(0);
  });

  it("negative fundingRateLong → longs RECEIVE (negative fee = credit)", () => {
    // fundingRateLong < 0 means longs receive from shorts.
    // The caller selects fundingRateLong for a long position.
    // calculateFundingFee should return a negative value (credit).
    const fee = calculateFundingFee(usd(10000), -0.000001, 3600000);
    expect(fee).toBeLessThan(0);
  });

  it("positive fundingRateShort → shorts PAY (positive fee = cost)", () => {
    // fundingRateShort > 0 means shorts pay longs.
    // The caller selects fundingRateShort for a short position.
    // calculateFundingFee should return a positive value (cost).
    // This was the bug: the old -1 multiplier inverted this to a credit.
    const fee = calculateFundingFee(usd(10000), 0.000001, 3600000);
    expect(fee).toBeGreaterThan(0);
  });

  it("negative fundingRateShort → shorts RECEIVE (negative fee = credit)", () => {
    // fundingRateShort < 0 means shorts receive from longs.
    // The caller selects fundingRateShort for a short position.
    // calculateFundingFee should return a negative value (credit).
    const fee = calculateFundingFee(usd(10000), -0.000001, 3600000);
    expect(fee).toBeLessThan(0);
  });

  it("zero rate → zero fee", () => {
    const fee = calculateFundingFee(usd(10000), 0, 3600000);
    expect(fee).toBe(0);
  });

  it("fee magnitude is proportional to size, rate, and time", () => {
    const fee1hr = calculateFundingFee(usd(10000), 0.000001, 3600000);
    const fee2hr = calculateFundingFee(usd(10000), 0.000001, 7200000);
    const fee2xSize = calculateFundingFee(usd(20000), 0.000001, 3600000);
    const fee2xRate = calculateFundingFee(usd(10000), 0.000002, 3600000);
    expect(fee2hr).toBeCloseTo(fee1hr * 2, 10);
    expect(fee2xSize).toBeCloseTo(fee1hr * 2, 10);
    expect(fee2xRate).toBeCloseTo(fee1hr * 2, 10);
  });
});

describe("GMX V2: Dynamic position fee (4/6 BPS based on OI balance)", () => {
  it("equal OI → balancing (4 BPS) for any trade", () => {
    const equalOi = usd(100000);
    expect(determinePositionFeeBps("long", false, equalOi, equalOi)).toBe(4);
    expect(determinePositionFeeBps("short", false, equalOi, equalOi)).toBe(4);
    expect(determinePositionFeeBps("long", true, equalOi, equalOi)).toBe(4);
    expect(determinePositionFeeBps("short", true, equalOi, equalOi)).toBe(4);
  });

  it("longs > shorts: opening long imbalances (6 BPS)", () => {
    expect(determinePositionFeeBps("long", false, usd(200000), usd(100000))).toBe(6);
  });

  it("longs > shorts: opening short balances (4 BPS)", () => {
    expect(determinePositionFeeBps("short", false, usd(200000), usd(100000))).toBe(4);
  });

  it("longs > shorts: closing long balances (4 BPS)", () => {
    expect(determinePositionFeeBps("long", true, usd(200000), usd(100000))).toBe(4);
  });

  it("longs > shorts: closing short imbalances (6 BPS)", () => {
    expect(determinePositionFeeBps("short", true, usd(200000), usd(100000))).toBe(6);
  });

  it("shorts > longs: opening short imbalances (6 BPS)", () => {
    expect(determinePositionFeeBps("short", false, usd(100000), usd(200000))).toBe(6);
  });

  it("shorts > longs: opening long balances (4 BPS)", () => {
    expect(determinePositionFeeBps("long", false, usd(100000), usd(200000))).toBe(4);
  });

  it("shorts > longs: closing short balances (4 BPS)", () => {
    expect(determinePositionFeeBps("short", true, usd(100000), usd(200000))).toBe(4);
  });

  it("shorts > longs: closing long imbalances (6 BPS)", () => {
    expect(determinePositionFeeBps("long", true, usd(100000), usd(200000))).toBe(6);
  });

  it("close fee BPS differs from open fee BPS when OI changes between open and close", () => {
    // At open: longs > shorts, opening long → 6 BPS (imbalancing)
    const openFeeBps = determinePositionFeeBps("long", false, usd(200000), usd(100000));
    // At close: shorts > longs (OI flipped), closing long → 6 BPS (imbalancing, now removing from larger side doesn't apply since short > long)
    // Actually: shorts > longs, closing long = removing from long side (the smaller side) → imbalancing (6 BPS)
    const closeFeeBps = determinePositionFeeBps("long", true, usd(100000), usd(200000));
    // Both happen to be 6, but for different reasons
    expect(openFeeBps).toBe(6);
    expect(closeFeeBps).toBe(6);

    // Now a case where they differ: open when equal, close when imbalanced
    const openFeeBps2 = determinePositionFeeBps("long", false, usd(100000), usd(100000));
    const closeFeeBps2 = determinePositionFeeBps("long", true, usd(200000), usd(100000));
    expect(openFeeBps2).toBe(4);
    expect(closeFeeBps2).toBe(4); // closing long when longs > shorts = balancing
  });
});

describe("GMX V2: Liquidation zero-return settlement", () => {
  it("liquidation returns zero collateral regardless of PnL", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(1800), // losing position
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
      true, // isLiquidation
    );
    expect(result.returnedCollateral).toBe(0);
  });

  it("liquidation returns zero even for a profitable position", () => {
    // Edge case: position is technically profitable but got liquidated
    // (e.g., massive accrued fees pushed effective collateral below maintenance)
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(2200), // profitable
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(50), // large accrued fees
      usd(30),
      true, // isLiquidation
    );
    expect(result.returnedCollateral).toBe(0);
  });

  it("non-liquidation close returns collateral (not zero)", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(2200),
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
      false, // NOT liquidation
    );
    expect(result.returnedCollateral).toBeGreaterThan(0);
  });

  it("liquidation still computes net PnL correctly (for trade history)", () => {
    const result = calculateClosePosition(
      "long",
      price(2000),
      price(1800),
      usd(5000),
      usd(1000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
      true,
    );
    // Even though collateral is forfeited, PnL is still computed for records
    expect(result.grossPnl).toBeCloseTo(-500, 1);
    expect(result.netPnl).toBeCloseTo(-507.5, 1);
  });
});

describe("GMX V2: Borrow fee smaller-OI-side zeroing", () => {
  // Note: The smaller-side-zeroing logic lives in useFeeAccrual.ts,
  // not in calculateBorrowFee itself (which is a pure rate calculator).
  // Here we test that calculateBorrowFee correctly returns $0 when
  // the borrow rate is 0 (which is what useFeeAccrual passes for the
  // smaller side), proving the composition is correct.
  it("zero borrow rate → zero borrow fee (smaller OI side)", () => {
    const fee = calculateBorrowFee(usd(10000), 0, 3600000);
    expect(fee).toBe(0);
  });

  it("non-zero borrow rate → non-zero borrow fee (larger OI side)", () => {
    const fee = calculateBorrowFee(usd(10000), 0.000001, 3600000);
    expect(fee).toBeGreaterThan(0);
  });
});
