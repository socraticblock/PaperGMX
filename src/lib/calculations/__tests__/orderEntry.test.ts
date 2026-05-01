/**
 * Order Entry Integration Tests
 *
 * Tests the full order entry flow — from raw inputs to final position object.
 * Validates that all pure calculation functions compose correctly.
 */

import { describe, it, expect } from "vitest";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateHourlyBorrowFee,
  calculateLiquidationPrice,
  calculateAcceptablePrice,
  determineFillPrice,
  calculateGrossPnl,
  calculateNetPnl,
} from "../index";
import { usd, price, bps } from "@/lib/branded";
import type { OrderDirection } from "@/types";

// ─── Helpers ──────────────────────────────────────────────

function runOrderEntryScenario({
  direction,
  collateral,
  leverage,
  oracleMin,
  oracleMax,
  maintenanceMarginBps,
  positionFeeBps,
  borrowRatePerSecond,
}: {
  direction: OrderDirection;
  collateral: number;
  leverage: number;
  oracleMin: number;
  oracleMax: number;
  maintenanceMarginBps: number;
  positionFeeBps: number;
  borrowRatePerSecond: number;
}) {
  const collateralUsd = usd(collateral);
  const sizeUsd = calculatePositionSize(collateralUsd, leverage);
  const fillPrice = determineFillPrice(
    price(oracleMin),
    price(oracleMax),
    direction,
    false,
  );
  const acceptablePrice = calculateAcceptablePrice(
    fillPrice,
    bps(50), // 0.5% slippage
    direction,
    false,
  );
  const positionFee = calculatePositionFee(sizeUsd, bps(positionFeeBps));
  const liquidationPrice = calculateLiquidationPrice(
    direction,
    fillPrice,
    collateralUsd,
    sizeUsd,
    bps(maintenanceMarginBps),
    bps(20), // liquidationFeeBps (0.2% for BTC/ETH)
    positionFee, // Position fee reduces effective collateral
    usd(0), // No accrued fees at open
  );
  const hourlyBorrowFee = calculateHourlyBorrowFee(
    sizeUsd,
    borrowRatePerSecond,
  );

  return {
    sizeUsd,
    fillPrice,
    acceptablePrice,
    positionFee,
    liquidationPrice,
    hourlyBorrowFee,
  };
}

// ─── Test Suite ───────────────────────────────────────────

describe("Order Entry Integration", () => {
  describe("Long ETH at 10x leverage", () => {
    const result = runOrderEntryScenario({
      direction: "long",
      collateral: 1000,
      leverage: 10,
      oracleMin: 3000,
      oracleMax: 3001,
      maintenanceMarginBps: 50, // 0.5%
      positionFeeBps: 6,
      borrowRatePerSecond: 0.00000142, // ~4.5% annualized
    });

    it("calculates correct position size", () => {
      expect(result.sizeUsd).toBe(10000);
    });

    it("uses max oracle price for long fill", () => {
      expect(result.fillPrice).toBe(3001);
    });

    it("acceptable price is above fill price (slippage up for long)", () => {
      expect(result.acceptablePrice).toBeGreaterThan(result.fillPrice);
    });

    it("calculates position fee at 6 BPS", () => {
      expect(result.positionFee).toBeCloseTo(6, 1); // 10000 * 0.0006 = $6
    });

    it("liquidation price is below entry for long", () => {
      expect(result.liquidationPrice).toBeLessThan(result.fillPrice);
    });

    it("liquidation price is roughly 9.5% below entry", () => {
      // Trigger semantics exclude liquidation fee:
      // effectiveCollateral = 1000 - 6 - 0 - 10000*0.005 = 944
      // liqPrice = 3001 * (1 - 944/10000) = 2717.7056
      expect(result.liquidationPrice).toBeCloseTo(2717.7, 0);
    });

    it("estimates hourly borrow fee", () => {
      // 10000 * 1.42e-9 * 3600 ≈ $0.000051 per hour
      // With the test rate of 1.42e-6 (1000x higher), result is ~$51.12
      expect(result.hourlyBorrowFee).toBeCloseTo(51.12, 0);
    });
  });

  describe("Short BTC at 5x leverage", () => {
    const result = runOrderEntryScenario({
      direction: "short",
      collateral: 5000,
      leverage: 5,
      oracleMin: 74999,
      oracleMax: 75001,
      maintenanceMarginBps: 50,
      positionFeeBps: 4,
      borrowRatePerSecond: 0.00000285, // ~9% annualized
    });

    it("calculates correct position size", () => {
      expect(result.sizeUsd).toBe(25000);
    });

    it("uses min oracle price for short fill", () => {
      expect(result.fillPrice).toBe(74999);
    });

    it("acceptable price is below fill price (slippage down for short open)", () => {
      expect(result.acceptablePrice).toBeLessThan(result.fillPrice);
    });

    it("calculates position fee at 4 BPS", () => {
      expect(result.positionFee).toBeCloseTo(10, 0); // 25000 * 0.0004 = $10
    });

    it("liquidation price is above entry for short", () => {
      expect(result.liquidationPrice).toBeGreaterThan(result.fillPrice);
    });
  });

  describe("Long SOL at 25x leverage (high leverage)", () => {
    const result = runOrderEntryScenario({
      direction: "long",
      collateral: 500,
      leverage: 25,
      oracleMin: 150,
      oracleMax: 150.1,
      maintenanceMarginBps: 100, // 1% for SOL
      positionFeeBps: 6,
      borrowRatePerSecond: 0.0000038, // ~12% annualized
    });

    it("calculates correct position size", () => {
      expect(result.sizeUsd).toBe(12500);
    });

    it("liquidation is very close to entry (high leverage + high margin)", () => {
      const liqPrice = result.liquidationPrice!;
      const distanceFromEntry =
        ((result.fillPrice - liqPrice) / result.fillPrice) * 100;
      // With 25x and 1% maintenance margin, liquidation is very close
      expect(distanceFromEntry).toBeLessThan(5);
    });

    it("position fee is significant at high leverage", () => {
      expect(result.positionFee).toBeCloseTo(7.5, 1); // 12500 * 0.0006 = $7.50
    });
  });

  describe("Edge case: Minimum collateral at 1x leverage", () => {
    const result = runOrderEntryScenario({
      direction: "long",
      collateral: 1,
      leverage: 1,
      oracleMin: 3000,
      oracleMax: 3001,
      maintenanceMarginBps: 50,
      positionFeeBps: 6,
      borrowRatePerSecond: 0,
    });

    it("position size equals collateral at 1x", () => {
      expect(result.sizeUsd).toBe(1);
    });

    it("position fee is tiny", () => {
      expect(result.positionFee).toBeCloseTo(0.0006, 4);
    });

    it("no borrow fee when rate is zero", () => {
      expect(result.hourlyBorrowFee).toBe(0);
    });
  });

  describe("Full P&L flow: Long ETH, price moves up 10%", () => {
    const entryPrice = price(3000);
    const exitPrice = price(3300); // +10%
    const sizeUsd = usd(10000);
    const positionFeeOpen = usd(6);
    const positionFeeClose = usd(6);

    const grossPnl = calculateGrossPnl("long", entryPrice, exitPrice, sizeUsd);
    const netPnl = calculateNetPnl(
      grossPnl,
      positionFeeOpen,
      positionFeeClose,
      usd(0.5),
      usd(0),
    );

    it("gross P&L is 10% of size", () => {
      expect(grossPnl).toBeCloseTo(1000, 0); // 10000 * 10% = $1000
    });

    it("net P&L deducts fees", () => {
      // grossPnl (1000) - feeOpen (6) - feeClose (6) - borrow (0.5) - funding (0) = 987.5
      expect(netPnl).toBeCloseTo(987.5, 1);
    });
  });

  describe("Full P&L flow: Short ETH, price moves up 10% (loss)", () => {
    const entryPrice = price(3000);
    const exitPrice = price(3300); // +10% (bad for short)
    const sizeUsd = usd(10000);
    const positionFeeOpen = usd(6);
    const positionFeeClose = usd(6);

    const grossPnl = calculateGrossPnl("short", entryPrice, exitPrice, sizeUsd);
    const netPnl = calculateNetPnl(
      grossPnl,
      positionFeeOpen,
      positionFeeClose,
      usd(0.5),
      usd(0),
    );

    it("gross P&L is negative", () => {
      expect(grossPnl).toBeLessThan(0);
      expect(grossPnl).toBeCloseTo(-1000, 0);
    });

    it("net P&L is even more negative (fees add to loss)", () => {
      expect(netPnl).toBeLessThan(grossPnl);
    });
  });
});
