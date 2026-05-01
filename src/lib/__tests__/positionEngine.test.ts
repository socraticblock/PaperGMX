import { describe, expect, it } from "vitest";
import {
  calculateFeeAccrualDelta,
  estimateExecutionFeeUsd,
  getBorrowRateForPosition,
  getExecutionPrice,
  getFundingRateForPosition,
  getMarkPrice,
  getPositionFee,
  getPositionFeeBps,
  getWorstClosePrice,
} from "@/lib/positionEngine";
import { bps, percent, price, timestamp, usd } from "@/lib/branded";
import type { MarketInfo, Position, PriceData } from "@/types";

function marketInfo(overrides?: Partial<MarketInfo>): MarketInfo {
  return {
    slug: "eth",
    longOi: usd(200_000),
    shortOi: usd(100_000),
    borrowRateLong: 0.000001,
    borrowRateShort: 0.000002,
    borrowRateLongAnnualized: 31.536,
    borrowRateShortAnnualized: 63.072,
    fundingRateLong: 0.0000001,
    fundingRateShort: -0.0000001,
    fundingRateLongAnnualized: 3.1536,
    fundingRateShortAnnualized: -3.1536,
    positionFeeBps: bps(6),
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
