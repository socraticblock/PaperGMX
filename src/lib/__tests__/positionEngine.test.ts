import { describe, expect, it } from "vitest";
import {
  calculateFeeAccrualDelta,
  calculateCloseSettlement,
  capPositivePnl,
  determineBalanceWasImproved,
  determinePositionFeeBpsFromDelta,
  estimateExecutionFeeUsd,
  getBorrowRateForPosition,
  getExecutionPrice,
  getFundingRateForPosition,
  getMarkPrice,
  getMaxPnlFactorForTraders,
  getPositionFee,
  getPositionFeeBps,
  getPositionFeeBpsWithDelta,
  getWorstClosePrice,
  DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS,
} from "@/lib/positionEngine";
import { calculateClosePosition } from "@/lib/calculations";
import { bps, percent, price, timestamp, usd } from "@/lib/branded";
import type { MarketInfo, Position, PriceData } from "@/types";

function marketInfo(overrides?: Partial<MarketInfo>): MarketInfo {
  return {
    slug: "eth",
    longOi: usd(200_000),
    shortOi: usd(100_000),
    availableLiquidityLong: usd(0),
    availableLiquidityShort: usd(0),
    totalLiquidityUsd: usd(0),
    borrowRateLong: 0.000001,
    borrowRateShort: 0.000002,
    borrowRateLongAnnualized: 31.536,
    borrowRateShortAnnualized: 63.072,
    fundingRateLong: 0.0000001,
    fundingRateShort: -0.0000001,
    fundingRateLongAnnualized: 3.1536,
    fundingRateShortAnnualized: -3.1536,
    netRateLongAnnualized: 0,
    netRateShortAnnualized: 0,
    positionFeeBps: bps(6),
    maxPnlFactorForTraders: 0.5,
    ...overrides,
  };
}

function position(overrides?: Partial<Position>): Position {
  return {
    id: "eth-long-test",
    market: "eth",
    direction: "long",
    collateralUsd: usd(1_000),
    leverage: 5,
    sizeUsd: usd(5_000),
    sizeInTokens: 2.5,
    entryPrice: price(2_000),
    acceptablePrice: price(2_010),
    liquidationPrice: price(1_600),
    positionFeeBps: bps(6),
    positionFeePaid: usd(3),
    borrowFeeAccrued: usd(0),
    fundingFeeAccrued: usd(0),
    openedAt: timestamp(1_700_000_000_000),
    confirmedAt: timestamp(1_700_000_001_000),
    status: "active",
    ...overrides,
  };
}

const priceData: PriceData = {
  min: price(1_995),
  max: price(2_005),
  last: price(2_000),
  change24h: percent(0),
};

describe("positionEngine prices", () => {
  it("uses mid price for mark PnL display", () => {
    expect(getMarkPrice(priceData)).toBe(2_000);
  });

  it("uses the trader-worst oracle side for execution", () => {
    expect(getExecutionPrice("long", priceData, false)).toBe(2_005);
    expect(getExecutionPrice("long", priceData, true)).toBe(1_995);
    expect(getExecutionPrice("short", priceData, false)).toBe(1_995);
    expect(getExecutionPrice("short", priceData, true)).toBe(2_005);
  });

  it("uses the same execution rule for worst close price", () => {
    expect(getWorstClosePrice("long", priceData)).toBe(1_995);
    expect(getWorstClosePrice("short", priceData)).toBe(2_005);
  });
});

describe("positionEngine fees", () => {
  it("returns 4 bps when an order balances OI and 6 bps when it imbalances", () => {
    const info = marketInfo({ longOi: usd(200_000), shortOi: usd(100_000) });

    expect(getPositionFeeBps("short", false, info)).toBe(4);
    expect(getPositionFeeBps("long", false, info)).toBe(6);
    expect(getPositionFeeBps("long", true, info)).toBe(4);
    expect(getPositionFeeBps("short", true, info)).toBe(6);
  });

  it("falls back to the default imbalancing fee when market info is missing", () => {
    expect(getPositionFeeBps("long", false, undefined)).toBe(6);
    expect(getPositionFee(usd(10_000), "long", false, undefined).feeUsd).toBe(6);
  });

  it("zeros borrow fee rate for the smaller OI side every accrual tick", () => {
    const info = marketInfo({ longOi: usd(200_000), shortOi: usd(100_000) });

    expect(getBorrowRateForPosition("short", info)).toBe(0);
    expect(getBorrowRateForPosition("long", info)).toBe(info.borrowRateLong);
  });

  it("does not zero borrow fee when OI is exactly equal", () => {
    const info = marketInfo({ longOi: usd(150_000), shortOi: usd(150_000) });
    expect(getBorrowRateForPosition("long", info)).toBe(info.borrowRateLong);
    expect(getBorrowRateForPosition("short", info)).toBe(info.borrowRateShort);
  });

  it("selects the signed funding rate for the position side", () => {
    const info = marketInfo({
      fundingRateLong: 0.0000003,
      fundingRateShort: -0.0000002,
    });

    expect(getFundingRateForPosition("long", info)).toBe(0.0000003);
    expect(getFundingRateForPosition("short", info)).toBe(-0.0000002);
  });

  it("calculates accrual deltas from centralized borrow and funding rules", () => {
    const delta = calculateFeeAccrualDelta(
      position({ direction: "short" }),
      marketInfo({
        longOi: usd(200_000),
        shortOi: usd(100_000),
        fundingRateShort: -0.0000001,
      }),
      3_600_000,
    );

    expect(delta.borrowRatePerSecond).toBe(0);
    expect(delta.borrowFeeDelta).toBe(0);
    expect(delta.fundingRatePerSecond).toBe(-0.0000001);
    expect(delta.fundingFeeDelta).toBeLessThan(0);
  });
});

describe("positionEngine execution fee estimate", () => {
  it("models gas limit, gas price, and ETH price without touching PnL math", () => {
    const estimate = estimateExecutionFeeUsd({
      gasLimit: 1_000_000,
      gasPriceGwei: 0.2,
      ethPriceUsd: 3_250,
    });

    expect(estimate).toBeCloseTo(0.65, 6);
  });
});

// ─── PnL Cap Tests ────────────────────────────────────────

describe("positionEngine: maxPnlFactorForTraders retrieval", () => {
  it("returns the market's factor when present", () => {
    const info = marketInfo({ maxPnlFactorForTraders: 0.3 });
    expect(getMaxPnlFactorForTraders(info)).toBe(0.3);
  });

  it("falls back to default when market info is undefined", () => {
    expect(getMaxPnlFactorForTraders(undefined)).toBe(DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS);
  });

  it("falls back to default when factor is zero", () => {
    const info = marketInfo({ maxPnlFactorForTraders: 0 });
    expect(getMaxPnlFactorForTraders(info)).toBe(DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS);
  });

  it("falls back to default when factor is negative", () => {
    const info = marketInfo({ maxPnlFactorForTraders: -0.1 });
    expect(getMaxPnlFactorForTraders(info)).toBe(DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS);
  });

  it("falls back to default when factor is NaN", () => {
    const info = marketInfo({ maxPnlFactorForTraders: NaN });
    expect(getMaxPnlFactorForTraders(info)).toBe(DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS);
  });
});

describe("positionEngine: capPositivePnl", () => {
  it("does not cap negative PnL (losses pass through)", () => {
    const result = capPositivePnl(usd(-500), usd(10_000), 0.5);
    expect(result).toBe(-500);
  });

  it("does not cap zero PnL", () => {
    const result = capPositivePnl(usd(0), usd(10_000), 0.5);
    expect(result).toBe(0);
  });

  it("caps positive PnL at sizeUsd * maxPnlFactor", () => {
    // sizeUsd=10000, factor=0.5 → max=5000
    const result = capPositivePnl(usd(6_000), usd(10_000), 0.5);
    expect(result).toBe(5_000);
  });

  it("does not cap positive PnL that is below the threshold", () => {
    const result = capPositivePnl(usd(3_000), usd(10_000), 0.5);
    expect(result).toBe(3_000);
  });

  it("caps at exactly the threshold (boundary)", () => {
    const result = capPositivePnl(usd(5_000), usd(10_000), 0.5);
    expect(result).toBe(5_000);
  });

  it("works with a tighter factor (0.1 = 10%)", () => {
    // sizeUsd=10000, factor=0.1 → max=1000
    const result = capPositivePnl(usd(2_000), usd(10_000), 0.1);
    expect(result).toBe(1_000);
  });

  it("works with a loose factor (1.0 = 100%, effectively no cap)", () => {
    const result = capPositivePnl(usd(9_999), usd(10_000), 1.0);
    expect(result).toBe(9_999);
  });
});

// ─── Balance-Improved Fee Classification Tests ─────────────

describe("positionEngine: determineBalanceWasImproved", () => {
  it("opening the smaller side improves balance", () => {
    // longs=200k, shorts=100k. Opening short (smaller side) reduces imbalance.
    expect(
      determineBalanceWasImproved("short", false, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(true);
  });

  it("opening the larger side worsens balance", () => {
    // longs=200k, shorts=100k. Opening long (larger side) increases imbalance.
    expect(
      determineBalanceWasImproved("long", false, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(false);
  });

  it("closing the larger side improves balance", () => {
    // longs=200k, shorts=100k. Closing long (larger side) reduces imbalance.
    expect(
      determineBalanceWasImproved("long", true, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(true);
  });

  it("closing the smaller side worsens balance", () => {
    // longs=200k, shorts=100k. Closing short (smaller side) increases imbalance.
    expect(
      determineBalanceWasImproved("short", true, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(false);
  });

  it("equal OI: any trade is neutral (not improved)", () => {
    // With equal OI, any trade creates imbalance where none existed.
    // imbalanceBefore=0, imbalanceAfter=delta → not improved.
    expect(
      determineBalanceWasImproved("long", false, usd(100_000), usd(100_000), usd(10_000)),
    ).toBe(false);
  });

  it("crossover: trade that flips which side is larger", () => {
    // longs=110k, shorts=100k. Opening short with size=20k.
    // After: longs=110k, shorts=120k. Shorts now larger.
    // imbalanceBefore=10k, imbalanceAfter=10k → NOT improved (equal).
    expect(
      determineBalanceWasImproved("short", false, usd(110_000), usd(100_000), usd(20_000)),
    ).toBe(false);

    // But with size=25k: after=longs 110k, shorts 125k
    // imbalanceBefore=10k, imbalanceAfter=15k → NOT improved.
    expect(
      determineBalanceWasImproved("short", false, usd(110_000), usd(100_000), usd(25_000)),
    ).toBe(false);

    // With size=5k: after=longs 110k, shorts 105k
    // imbalanceBefore=10k, imbalanceAfter=5k → IMPROVED.
    expect(
      determineBalanceWasImproved("short", false, usd(110_000), usd(100_000), usd(5_000)),
    ).toBe(true);
  });

  it("closing position larger than imbalance difference (overshoot)", () => {
    // longs=105k, shorts=100k. Closing long with size=10k.
    // After: longs=95k, shorts=100k. Shorts now larger.
    // imbalanceBefore=5k, imbalanceAfter=5k → NOT improved.
    expect(
      determineBalanceWasImproved("long", true, usd(105_000), usd(100_000), usd(10_000)),
    ).toBe(false);

    // Closing long with size=3k.
    // After: longs=102k, shorts=100k.
    // imbalanceBefore=5k, imbalanceAfter=2k → IMPROVED.
    expect(
      determineBalanceWasImproved("long", true, usd(105_000), usd(100_000), usd(3_000)),
    ).toBe(true);
  });
});

describe("positionEngine: determinePositionFeeBpsFromDelta", () => {
  it("returns 4 BPS when balance improves", () => {
    // longs=200k, shorts=100k, opening short=10k → improves balance
    expect(
      determinePositionFeeBpsFromDelta("short", false, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(4);
  });

  it("returns 6 BPS when balance worsens", () => {
    // longs=200k, shorts=100k, opening long=10k → worsens balance
    expect(
      determinePositionFeeBpsFromDelta("long", false, usd(200_000), usd(100_000), usd(10_000)),
    ).toBe(6);
  });

  it("falls back to side-heuristic when sizeDeltaUsd is zero", () => {
    // With zero delta, falls back to determinePositionFeeBps
    // longs=200k, shorts=100k, opening short → side-heuristic says 4 BPS
    expect(
      determinePositionFeeBpsFromDelta("short", false, usd(200_000), usd(100_000), usd(0)),
    ).toBe(4);
  });
});

describe("positionEngine: getPositionFeeBpsWithDelta", () => {
  it("uses delta logic when sizeDeltaUsd is provided", () => {
    const info = marketInfo({ longOi: usd(200_000), shortOi: usd(100_000) });
    // Opening short with 10k → improves balance → 4 BPS
    expect(getPositionFeeBpsWithDelta("short", false, info, usd(10_000))).toBe(4);
    // Opening long with 10k → worsens balance → 6 BPS
    expect(getPositionFeeBpsWithDelta("long", false, info, usd(10_000))).toBe(6);
  });

  it("falls back to side-heuristic when sizeDeltaUsd is undefined", () => {
    const info = marketInfo({ longOi: usd(200_000), shortOi: usd(100_000) });
    // No delta provided → use side-heuristic
    expect(getPositionFeeBpsWithDelta("short", false, info, undefined)).toBe(4);
    expect(getPositionFeeBpsWithDelta("long", false, info, undefined)).toBe(6);
  });

  it("falls back to default when market info is missing", () => {
    expect(getPositionFeeBpsWithDelta("long", false, undefined, usd(10_000))).toBe(6);
  });
});

// ─── Close Settlement Waterfall Tests ─────────────────────

describe("positionEngine: calculateCloseSettlement (waterfall)", () => {
  it("applies PnL cap and flows through all settlement steps", () => {
    // Profitable long close: entry=2000, exit=3000, size=10000
    // grossPnl = (3000-2000)/2000 * 10000 = 5000
    // With maxPnlFactor=0.5, cap at 5000 → exactly at threshold, no clip
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(3_000),
      usd(10_000),
      usd(1_000),
      usd(3),    // positionFeeOpen
      bps(6),    // positionFeeCloseBps
      usd(1),    // borrowFeeAccrued
      usd(0.5),  // fundingFeeAccrued
      0.5,       // maxPnlFactor
    );

    expect(settlement.grossPnlUncapped).toBeCloseTo(5_000, 0);
    expect(settlement.grossPnl).toBeCloseTo(5_000, 0);
    expect(settlement.pnlCappedAmount).toBe(0);
    expect(settlement.collateralAfterPnl).toBeCloseTo(6_000, 0);      // 1000 + 5000
    expect(settlement.collateralAfterOpenFee).toBeCloseTo(5_997, 0);   // 6000 - 3
    expect(settlement.collateralAfterFunding).toBeCloseTo(5_996.5, 1); // 5997 - 0.5
    expect(settlement.collateralAfterBorrow).toBeCloseTo(5_995.5, 1);  // 5996.5 - 1
    expect(settlement.positionFeeClose).toBeCloseTo(6, 1);             // 10000 * 0.0006
    expect(settlement.collateralAfterCloseFee).toBeCloseTo(5_989.5, 1);
    expect(settlement.returnedCollateral).toBeCloseTo(5_989.5, 1);
  });

  it("clips positive PnL above the cap", () => {
    // Profitable long close: entry=2000, exit=4000, size=10000
    // grossPnl = (4000-2000)/2000 * 10000 = 10000
    // With maxPnlFactor=0.5, cap at 5000 → 5000 clipped off
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(4_000),
      usd(10_000),
      usd(1_000),
      usd(3),    // positionFeeOpen
      bps(6),    // positionFeeCloseBps
      usd(0),    // borrowFeeAccrued
      usd(0),    // fundingFeeAccrued
      0.5,       // maxPnlFactor
    );

    expect(settlement.grossPnlUncapped).toBeCloseTo(10_000, 0);
    expect(settlement.grossPnl).toBeCloseTo(5_000, 0);
    expect(settlement.pnlCappedAmount).toBeCloseTo(5_000, 0);
    expect(settlement.collateralAfterPnl).toBeCloseTo(6_000, 0);       // 1000 + 5000
    expect(settlement.collateralAfterOpenFee).toBeCloseTo(5_997, 0);    // 6000 - 3
  });

  it("never caps negative PnL (full loss passes through)", () => {
    // Losing long close: entry=2000, exit=1000, size=10000
    // grossPnl = (1000-2000)/2000 * 10000 = -5000
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(1_000),
      usd(10_000),
      usd(1_000),
      usd(3),    // positionFeeOpen
      bps(6),    // positionFeeCloseBps
      usd(0),    // borrowFeeAccrued
      usd(0),    // fundingFeeAccrued
      0.5,       // maxPnlFactor
    );

    expect(settlement.grossPnlUncapped).toBeCloseTo(-5_000, 0);
    expect(settlement.grossPnl).toBeCloseTo(-5_000, 0);
    expect(settlement.pnlCappedAmount).toBe(0);
  });

  it("floors returned collateral at zero for catastrophic loss", () => {
    // Massive loss: collateral + grossPnl + all fees < 0
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(100),  // catastrophic price drop
      usd(10_000),
      usd(1_000),
      usd(3),    // positionFeeOpen
      bps(6),    // positionFeeCloseBps
      usd(0),    // borrowFeeAccrued
      usd(0),    // fundingFeeAccrued
      0.5,       // maxPnlFactor
    );

    expect(settlement.returnedCollateral).toBeGreaterThanOrEqual(0);
    expect(settlement.netPnl).toBeLessThan(0);
  });

  it("insufficient collateral: fees exceed remaining after PnL", () => {
    // Small profit but huge accrued fees → collateral goes negative, then floored
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(2_100),  // small profit: grossPnl ≈ 500
      usd(10_000),
      usd(1_000),
      usd(3),    // positionFeeOpen
      bps(6),    // positionFeeCloseBps
      usd(800),  // massive borrow fees
      usd(500),  // massive funding fees
      0.5,       // maxPnlFactor
    );

    // collateralAfterPnl = 1000 + 500 = 1500
    // collateralAfterOpenFee = 1500 - 3 = 1497
    // collateralAfterFunding = 1497 - 500 = 997
    // collateralAfterBorrow = 997 - 800 = 197
    // collateralAfterCloseFee = 197 - 6 = 191
    expect(settlement.collateralAfterPnl).toBeCloseTo(1_500, 0);
    expect(settlement.returnedCollateral).toBeCloseTo(191, 0);
  });

  it("fees exceed collateral entirely → returned collateral is 0", () => {
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(2_000),  // zero PnL
      usd(10_000),
      usd(1_000),
      usd(3),
      bps(6),
      usd(800),
      usd(500),
      0.5,
    );

    // collateralAfterPnl = 1000 + 0 = 1000
    // collateralAfterOpenFee = 1000 - 3 = 997
    // collateralAfterFunding = 997 - 500 = 497
    // collateralAfterBorrow = 497 - 800 = -303
    // collateralAfterCloseFee = -303 - 6 = -309
    // returnedCollateral = max(0, -309) = 0
    expect(settlement.returnedCollateral).toBe(0);
  });

  it("settlement matches simple calculateClosePosition when no cap applies", () => {
    // When grossPnl < cap, the waterfall should give the same results
    // as calculateClosePosition (no clipping, same fee logic).
    // Note: settlement.netPnl = collateralUsd + (grossPnl - fees) which
    // is the remaining collateral after all deductions. The simple
    // calculateClosePosition.netPnl = grossPnl - fees (without collateralUsd).
    // So we compare returnedCollateral and grossPnl instead.
    const settlement = calculateCloseSettlement(
      "long",
      price(2_000),
      price(2_200),  // grossPnl ≈ 1000, well under 5000 cap
      usd(10_000),
      usd(1_000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
      0.5,  // cap at 5000
    );

    const simple = calculateClosePosition(
      "long",
      price(2_000),
      price(2_200),
      usd(10_000),
      usd(1_000),
      usd(3),
      bps(6),
      usd(1),
      usd(0.5),
    );

    expect(settlement.grossPnl).toBeCloseTo(simple.grossPnl, 6);
    expect(settlement.returnedCollateral).toBeCloseTo(simple.returnedCollateral, 6);
    expect(settlement.netPnl).toBeCloseTo(simple.netPnl, 6);
  });
});
