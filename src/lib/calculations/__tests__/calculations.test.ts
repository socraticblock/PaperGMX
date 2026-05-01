import { describe, it, expect } from "vitest";
import {
  calculateGrossPnl,
  calculatePositionFee,
  calculateBorrowFee,
  calculateLiquidationPrice,
  calculateAcceptablePrice,
  determineFillPrice,
  calculatePositionSize,
  calculateClosePosition,
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
    expect(liqPriceWithFees).toBeGreaterThan(liqPriceNoFees);
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
    expect(liqPriceWithPositionFee).toBeGreaterThan(liqPriceNoPositionFee);
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
    expect(liqPriceWithLiqFee).toBeGreaterThan(liqPriceNoLiqFee);
  });

  it("short liquidation returns 0 when underwater (negative effective collateral)", () => {
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
    // liqPrice = 2000 * (1 + (-14970)/10000) = 2000 * (-0.497) = -994 → returns 0
    // Zero signals "no valid liquidation price" — position is deeply insolvent
    expect(liqPrice).toBe(0);
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
