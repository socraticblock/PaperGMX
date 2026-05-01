"use client";

import { useMemo } from "react";
import type { Position, PriceData, MarketSlug, USD, Price, ClosedTrade } from "@/types";
import { usd, percent, type Percent } from "@/lib/branded";
import {
  calculateGrossPnl,
  calculateNetPnl,
  calculatePositionFee,
  calculateLiquidationPrice,
  calculateBorrowFee,
} from "@/lib/calculations";
import { MARKETS } from "@/lib/constants";

// ─── Return type ─────────────────────────────────────────

export interface PositionPnlResult {
  /** Gross P&L (before fees) */
  grossPnl: USD;
  /** Net P&L (after all fees: position fee open + close, borrow, funding) */
  netPnl: USD;
  /** P&L as percentage of collateral */
  pnlPercent: Percent;
  /** Distance from current price to liquidation price, as % */
  distanceToLiq: Percent;
  /** Current market price (worst price for trader on close), null if unavailable */
  currentPrice: Price | null;
  /** Estimated hourly borrow fee */
  hourlyBorrowFee: USD;
  /** Whether the position is liquidatable */
  isLiquidatable: boolean;
  /** Close reason to use if liquidated */
  liquidationReason: ClosedTrade["closeReason"] | null;
  /** Recalculated liquidation price (accounts for accrued fees) */
  recalculatedLiqPrice: Price | null;
}

// ─── Null result (when no position or no price data) ────

const NULL_RESULT: PositionPnlResult = {
  grossPnl: usd(0),
  netPnl: usd(0),
  pnlPercent: percent(0),
  distanceToLiq: percent(0),
  currentPrice: null,
  hourlyBorrowFee: usd(0),
  isLiquidatable: false,
  liquidationReason: null,
  recalculatedLiqPrice: null,
};

// ─── Hook ────────────────────────────────────────────────

/**
 * Computes live P&L from the active position and current prices.
 * Updates every time prices change (prices update every 3 seconds).
 * Uses the existing pure calculation functions from @/lib/calculations.
 *
 * Key improvements:
 * - Recalculates liquidation price using accrued fees (was stale before)
 * - Returns null currentPrice instead of 0 (prevents NaN cascades)
 * - Computes hourly borrow fee from market info
 */
export function usePositionPnl(
  position: Position | null,
  prices: Record<MarketSlug, PriceData>,
  marketInfo?: Record<MarketSlug, import("@/types").MarketInfo>,
): PositionPnlResult {
  return useMemo(() => {
    if (!position) return NULL_RESULT;

    const priceData = prices[position.market];
    if (!priceData || priceData.last <= 0) return NULL_RESULT;

    // Current price: for P&L we use the "worse" price for the trader
    // When closing a long, you sell at the lower price (min)
    // When closing a short, you buy back at the higher price (max)
    const currentPrice: Price =
      position.direction === "long" ? priceData.min : priceData.max;

    // Gross P&L using exit price = current oracle worst price
    const grossPnl = calculateGrossPnl(
      position.direction,
      position.entryPrice,
      currentPrice,
      position.sizeUsd
    );

    // Estimate closing position fee
    const closeFeeBps = position.positionFeeBps;
    const positionFeeClose = calculatePositionFee(position.sizeUsd, closeFeeBps);

    // Net P&L = gross - (open fee + close fee + borrow + funding)
    const netPnl = calculateNetPnl(
      grossPnl,
      position.positionFeePaid,
      positionFeeClose,
      position.borrowFeeAccrued,
      position.fundingFeeAccrued
    );

    // P&L percentage relative to collateral
    const pnlPercent =
      position.collateralUsd > 0
        ? percent((netPnl / position.collateralUsd) * 100)
        : percent(0);

    // ─── Recalculate liquidation price with accrued fees ───
    // The stored liquidation price was calculated at position open with zero fees.
    // As borrow/funding fees accrue, the actual liquidation price moves closer.
    const marketConfig = MARKETS[position.market];
    const recalculatedLiqPrice = calculateLiquidationPrice(
      position.direction,
      position.entryPrice,
      position.collateralUsd,
      position.sizeUsd,
      marketConfig.maintenanceMarginBps,
      marketConfig.liquidationFeeBps,
      position.positionFeePaid,
      usd(position.borrowFeeAccrued + position.fundingFeeAccrued),
    );

    // Distance to liquidation (using recalculated price)
    const distanceToLiq = calculateDistanceToLiq(
      position.direction,
      currentPrice,
      recalculatedLiqPrice
    );

    // Is liquidatable? Check if current price crossed liquidation price
    const isLiquidatable = checkLiquidatable(
      position.direction,
      currentPrice,
      recalculatedLiqPrice
    );

    // Hourly borrow fee from market info
    const info = marketInfo?.[position.market];
    const borrowRatePerSecond =
      position.direction === "long"
        ? (info?.borrowRateLong ?? 0)
        : (info?.borrowRateShort ?? 0);
    const hourlyBorrowFee = calculateBorrowFee(
      position.sizeUsd,
      borrowRatePerSecond,
      3600_000,
    );

    return {
      grossPnl,
      netPnl,
      pnlPercent,
      distanceToLiq,
      currentPrice,
      hourlyBorrowFee,
      isLiquidatable,
      liquidationReason: isLiquidatable ? "liquidated" : null,
      recalculatedLiqPrice,
    };
  }, [position, prices, marketInfo]);
}

// ─── Helpers ─────────────────────────────────────────────

/**
 * Calculate distance from current price to liquidation price as a percentage.
 * For longs: liq price is below, distance = (current - liq) / current * 100
 * For shorts: liq price is above, distance = (liq - current) / current * 100
 */
function calculateDistanceToLiq(
  direction: Position["direction"],
  currentPrice: Price,
  liquidationPrice: Price
): Percent {
  if (currentPrice <= 0) return percent(0);

  if (direction === "long") {
    // Long: liquidation price is below entry
    // Distance = how far current price is above liq price
    const distance = ((currentPrice - liquidationPrice) / currentPrice) * 100;
    return percent(Math.max(0, distance));
  } else {
    // Short: liquidation price is above entry
    // Distance = how far current price is below liq price
    const distance = ((liquidationPrice - currentPrice) / currentPrice) * 100;
    return percent(Math.max(0, distance));
  }
}

/**
 * Check if a position is liquidatable based on current price vs liquidation price.
 * For longs: liquidated if current price <= liquidation price
 * For shorts: liquidated if current price >= liquidation price
 */
function checkLiquidatable(
  direction: Position["direction"],
  currentPrice: Price,
  liquidationPrice: Price
): boolean {
  if (direction === "long") {
    return currentPrice <= liquidationPrice;
  } else {
    return currentPrice >= liquidationPrice;
  }
}
