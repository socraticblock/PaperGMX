import type { USD, Price, BPS, OrderDirection } from "@/types";
import { usd, price, bpsToDecimal, applyBps, addUSD, subUSD, mulUSD } from "@/lib/branded";

// ─── Position Fee ──────────────────────────────────────────

/**
 * Calculate position fee (opening or closing).
 * GMX V2: 4 BPS (0.04%) if trade balances pool, 6 BPS (0.06%) if it imbalances.
 * @param sizeUsd - Position size in USD
 * @param feeBps - Fee rate in BPS (4 or 6 depending on OI balance)
 */
export function calculatePositionFee(sizeUsd: USD, feeBps: BPS): USD {
  if (sizeUsd < 0) throw new Error(`Invalid position size: ${sizeUsd}`);
  return applyBps(sizeUsd, feeBps);
}

// ─── Borrow Fee ────────────────────────────────────────────

/**
 * Calculate borrow fee for a time period.
 * GMX V2: borrow rate is per-second, annualized 45-130%.
 * Smaller OI side pays ZERO borrow fee.
 * @param sizeUsd - Position size in USD
 * @param borrowRatePerSecond - Annualized rate divided by seconds per year
 * @param durationMs - Time period in milliseconds
 */
export function calculateBorrowFee(
  sizeUsd: USD,
  borrowRatePerSecond: number,
  durationMs: number
): USD {
  if (sizeUsd < 0) throw new Error(`Invalid size: ${sizeUsd}`);
  if (borrowRatePerSecond < 0) throw new Error(`Invalid borrow rate: ${borrowRatePerSecond}`);
  if (durationMs < 0) throw new Error(`Invalid duration: ${durationMs}`);

  const secondsElapsed = durationMs / 1000;
  const fee = sizeUsd * borrowRatePerSecond * secondsElapsed;
  return usd(fee);
}

/**
 * Calculate hourly borrow fee for display.
 * @param sizeUsd - Position size in USD
 * @param borrowRatePerSecond - Per-second rate
 */
export function calculateHourlyBorrowFee(sizeUsd: USD, borrowRatePerSecond: number): USD {
  return calculateBorrowFee(sizeUsd, borrowRatePerSecond, 3600_000);
}

// ─── Funding Fee ───────────────────────────────────────────

/**
 * Calculate funding fee for a time period.
 * GMX V2: Longs pay shorts (or vice versa) based on OI imbalance.
 * Annualized rate ranges from 1% to 90% max (adaptive).
 * @param sizeUsd - Position size in USD
 * @param fundingRatePerSecond - Annualized rate divided by seconds per year
 * @param durationMs - Time period in milliseconds
 * @param direction - Position direction (longs pay when rate positive)
 */
export function calculateFundingFee(
  sizeUsd: USD,
  fundingRatePerSecond: number,
  durationMs: number,
  direction: OrderDirection
): USD {
  if (sizeUsd < 0) throw new Error(`Invalid size: ${sizeUsd}`);
  if (!Number.isFinite(fundingRatePerSecond)) throw new Error(`Invalid funding rate: ${fundingRatePerSecond}`);
  if (durationMs < 0) throw new Error(`Invalid duration: ${durationMs}`);

  const secondsElapsed = durationMs / 1000;
  const directionMultiplier = direction === "long" ? 1 : -1;
  const fee = sizeUsd * fundingRatePerSecond * secondsElapsed * directionMultiplier;
  return usd(fee);
}

// ─── Gross P&L ────────────────────────────────────────────

/**
 * Calculate gross P&L (before fees).
 * @param direction - Long or Short
 * @param entryPrice - Entry (fill) price
 * @param exitPrice - Exit (fill) price
 * @param sizeUsd - Position size in USD
 */
export function calculateGrossPnl(
  direction: OrderDirection,
  entryPrice: Price,
  exitPrice: Price,
  sizeUsd: USD
): USD {
  if (entryPrice <= 0) throw new Error(`Invalid entry price: ${entryPrice}`);
  if (exitPrice <= 0) throw new Error(`Invalid exit price: ${exitPrice}`);
  if (sizeUsd < 0) throw new Error(`Invalid position size: ${sizeUsd}`);

  const directionMultiplier = direction === "long" ? 1 : -1;
  const priceChangePercent = (exitPrice - entryPrice) / entryPrice;
  const result = directionMultiplier * priceChangePercent * sizeUsd;

  if (!Number.isFinite(result)) throw new Error(`Non-finite PnL: ${result}`);
  return usd(result);
}

// ─── Net P&L ──────────────────────────────────────────────

/**
 * Calculate net P&L after all fees.
 */
export function calculateNetPnl(
  grossPnl: USD,
  positionFeeOpen: USD,
  positionFeeClose: USD,
  borrowFeeTotal: USD,
  fundingFeeTotal: USD
): USD {
  return subUSD(grossPnl, addUSD(positionFeeOpen, addUSD(positionFeeClose, addUSD(borrowFeeTotal, fundingFeeTotal))));
}

// ─── Liquidation Price ─────────────────────────────────────

/**
 * Calculate liquidation price.
 * GMX V2: Full liquidation only.
 * 
 * For Long: liqPrice = entryPrice * (1 - (collateral - fees) / size)
 * For Short: liqPrice = entryPrice * (1 + (collateral - fees) / size)
 * 
 * Where fees = position fee + accumulated borrow + funding
 * Maintenance margin: 0.5% (BTC/ETH) or 1.0% (SOL/ARB)
 * 
 * @param direction - Long or Short
 * @param entryPrice - Entry fill price
 * @param collateralUsd - Collateral amount
 * @param sizeUsd - Position size
 * @param maintenanceMarginBps - Maintenance margin in BPS (50 or 100)
 * @param positionFee - Position fee paid at open (deducted from effective collateral)
 * @param accruedFees - Total accrued fees (borrow + funding)
 */
export function calculateLiquidationPrice(
  direction: OrderDirection,
  entryPrice: Price,
  collateralUsd: USD,
  sizeUsd: USD,
  maintenanceMarginBps: BPS,
  positionFee: USD,
  accruedFees: USD
): Price {
  if (entryPrice <= 0) throw new Error(`Invalid entry price: ${entryPrice}`);
  if (collateralUsd < 0) throw new Error(`Invalid collateral: ${collateralUsd}`);
  if (sizeUsd <= 0) throw new Error(`Invalid size: ${sizeUsd}`);

  const maintenanceMargin = bpsToDecimal(maintenanceMarginBps);
  // GMX V2: effectiveCollateral = collateral - positionFee - accruedFees - maintenanceMargin
  // Position fee is deducted from collateral at open in GMX V2
  const effectiveCollateral = collateralUsd - positionFee - accruedFees - sizeUsd * maintenanceMargin;

  if (direction === "long") {
    // Long liq: price drops so that collateral is wiped out
    const liqPrice = entryPrice * (1 - effectiveCollateral / sizeUsd);
    // If liqPrice <= 0, position is already underwater — return a tiny positive sentinel
    // This shouldn't happen in normal trading but protects against crash
    if (liqPrice <= 0) return price(0.01);
    return price(liqPrice);
  } else {
    // Short liq: price rises so that collateral is wiped out
    const liqPrice = entryPrice * (1 + effectiveCollateral / sizeUsd);
    // If effectiveCollateral is very negative, liqPrice could be negative or 0
    if (liqPrice <= 0) return price(0.01);
    return price(liqPrice);
  }
}

// ─── Acceptable Price (Slippage) ───────────────────────────

/**
 * Calculate acceptable price with slippage.
 * @param currentPrice - Current oracle price
 * @param slippageBps - Slippage tolerance in BPS (50 for open, 300 for close)
 * @param direction - Trade direction
 * @param isClose - Whether this is a close order
 */
export function calculateAcceptablePrice(
  currentPrice: Price,
  slippageBps: BPS,
  direction: OrderDirection,
  isClose: boolean
): Price {
  const slippage = bpsToDecimal(slippageBps);

  // For opens: Longs accept higher price, Shorts accept lower price
  // For closes: Longs accept lower price (selling), Shorts accept higher price (buying back)
  const isLong = direction === "long";
  const isWorsePrice = (isLong && !isClose) || (!isLong && isClose);

  if (isWorsePrice) {
    return price(currentPrice * (1 + slippage));
  } else {
    return price(currentPrice * (1 - slippage));
  }
}

// ─── Fill Price from Oracle ────────────────────────────────

/**
 * Determine fill price from oracle min/max spread.
 * GMX always uses the WORSE price for the trader.
 */
export function determineFillPrice(
  oracleMin: Price,
  oracleMax: Price,
  direction: OrderDirection,
  isClose: boolean
): Price {
  const isLong = direction === "long";

  // Long open / Short close → max price (worse for buyer)
  // Long close / Short open → min price (worse for seller)
  if ((isLong && !isClose) || (!isLong && isClose)) {
    return oracleMax;
  }
  return oracleMin;
}

// ─── Position Size ─────────────────────────────────────────

/**
 * Calculate position size from collateral and leverage.
 */
export function calculatePositionSize(collateralUsd: USD, leverage: number): USD {
  if (collateralUsd < 0) throw new Error(`Invalid collateral: ${collateralUsd}`);
  if (leverage <= 0) throw new Error(`Invalid leverage: ${leverage}`);
  return mulUSD(collateralUsd, leverage);
}

// ─── Close Position Composite ──────────────────────────────

export interface ClosePositionResult {
  grossPnl: USD;
  netPnl: USD;
  positionFeeClose: USD;
  borrowFeeTotal: USD;
  fundingFeeTotal: USD;
  returnedCollateral: USD;
}

/**
 * Calculate all values for closing a position.
 * This is the single source of truth for close calculations.
 */
export function calculateClosePosition(
  direction: OrderDirection,
  entryPrice: Price,
  exitPrice: Price,
  sizeUsd: USD,
  collateralUsd: USD,
  positionFeeOpen: USD,
  positionFeeCloseBps: BPS,
  borrowFeeAccrued: USD,
  fundingFeeAccrued: USD
): ClosePositionResult {
  const grossPnl = calculateGrossPnl(direction, entryPrice, exitPrice, sizeUsd);
  const positionFeeClose = calculatePositionFee(sizeUsd, positionFeeCloseBps);
  const netPnl = calculateNetPnl(grossPnl, positionFeeOpen, positionFeeClose, borrowFeeAccrued, fundingFeeAccrued);

  // Returned collateral = original collateral + net P&L
  // If net P&L is very negative, this could be < 0 (liquidation handles this)
  const returnedCollateral = Math.max(0, collateralUsd + netPnl);

  return {
    grossPnl,
    netPnl,
    positionFeeClose,
    borrowFeeTotal: borrowFeeAccrued,
    fundingFeeTotal: fundingFeeAccrued,
    returnedCollateral: usd(returnedCollateral),
  };
}
