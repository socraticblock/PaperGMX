"use client";

import { useMemo } from "react";
import type { Position, PriceData, MarketSlug, USD, Price, ClosedTrade } from "@/types";
import { bpsToDecimal, usd, percent, addUSD, type Percent } from "@/lib/branded";
import {
  calculateGrossPnl,
  calculateNetPnl,
  calculatePositionFee,
  calculateLiquidationPrice,
} from "@/lib/calculations";
import {
  calculateHourlyBorrowFeeForPosition,
  getMarkPrice,
  getMaxPnlFactorForTraders,
  getPositionFeeBps,
  getWorstClosePrice,
  capPositivePnl,
} from "@/lib/positionEngine";
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
  /** Current market mid-price (fair price for PnL display), null if unavailable */
  currentPrice: Price | null;
  /** Worst close price for the position (used for liquidation exit), null if unavailable */
  worstClosePrice: Price | null;
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
  worstClosePrice: null,
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

    // GMX V2: Live PnL display uses the mid/fair price, NOT the close-worst
    // price. The min/max spread is only relevant at actual execution time
    // (handled by the open/close keepers). Using mid-price for display gives
    // the trader an accurate view of their unrealized PnL without the
    // execution penalty baked in — that penalty is only charged on close.
    // Note: liquidation checks still use the worst price via isLiquidatable
    // below, which is the conservative check for actual close scenarios.
    const midPrice: Price = getMarkPrice(priceData);
    const currentPrice: Price = midPrice;

    // Worst close price: the price the position would actually close at.
    // Closing a long = selling at the lower price (min)
    // Closing a short = buying back at the higher price (max)
    // Used for liquidation exit price and conservative collateral checks.
    const worstClosePrice: Price = getWorstClosePrice(
      position.direction,
      priceData,
    );

    // Market info for fee rates and PnL cap
    const info = marketInfo?.[position.market];

    // Gross P&L using exit price = current oracle mid price
    let grossPnl = calculateGrossPnl(
      position.direction,
      position.entryPrice,
      currentPrice,
      position.sizeUsd,
      position.sizeInTokens,
    );

    // GMX V2: Cap positive PnL at sizeUsd * maxPnlFactorForTraders.
    // This only clips profits; losses pass through unmodified.
    const maxPnlFactor = getMaxPnlFactorForTraders(info);
    grossPnl = capPositivePnl(grossPnl, position.sizeUsd, maxPnlFactor);

    // Estimate closing position fee using current OI balance
    // GMX V2: close fee BPS is determined at close time based on OI
    const closeFeeBps = getPositionFeeBps(position.direction, true, info);
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
      addUSD(position.borrowFeeAccrued, position.fundingFeeAccrued),
    );

    // Distance to liquidation (using recalculated price)
    // If liq price is null (overcollateralized), distance is 100% (max safe)
    const distanceToLiq = recalculatedLiqPrice !== null
      ? calculateDistanceToLiq(position.direction, currentPrice, recalculatedLiqPrice)
      : percent(100);

    // Spec 8.5: liquidation is determined by remaining collateral falling
    // below the market minimum collateral requirement. The price threshold is
    // display guidance; the collateral invariant decides the actual trigger.
    const minCollateralUsdFloor = usd(1);
    const remainingCollateral = addUSD(position.collateralUsd, netPnl);
    const minCollateral =
      position.sizeUsd * bpsToDecimal(marketConfig.maintenanceMarginBps);
    const requiredMinCollateral = Math.max(minCollateral, minCollateralUsdFloor);
    const isLiquidatable = remainingCollateral <= requiredMinCollateral;

    // Hourly borrow fee from market info (reuses `info` declared above)
    const hourlyBorrowFee = calculateHourlyBorrowFeeForPosition(position, info);

    return {
      grossPnl,
      netPnl,
      pnlPercent,
      distanceToLiq,
      currentPrice,
      worstClosePrice,
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

