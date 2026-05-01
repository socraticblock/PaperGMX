import type {
  BPS,
  MarketConfig,
  MarketInfo,
  OrderDirection,
  Position,
  Price,
  PriceData,
  USD,
} from "@/types";
import { price, usd } from "@/lib/branded";
import {
  calculateBorrowFee,
  calculateFundingFee,
  calculateGrossPnl,
  calculatePositionFee,
  determineFillPrice,
  determinePositionFeeBps,
} from "@/lib/calculations";
import {
  DEFAULT_POSITION_FEE_BPS,
  POSITION_FEE_BALANCING_BPS,
  POSITION_FEE_IMBALANCING_BPS,
} from "@/lib/constants";

// ─── Defaults for missing MarketInfo fields ───────────────
// GMX V2 Reader contract always provides these, but we keep safe
// defaults for offline/fallback mode.

/** Default maxPnlFactorForTraders (50% of size). GMX on-chain default. */
export const DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS = 0.5;

export interface FeeAccrualDelta {
  borrowFeeDelta: USD;
  fundingFeeDelta: USD;
  borrowRatePerSecond: number;
  fundingRatePerSecond: number;
}

export interface ExecutionFeeEstimateInput {
  gasLimit?: number;
  gasPriceGwei?: number;
  ethPriceUsd?: number;
}

/**
 * Pure GMX V2 position engine helpers.
 *
 * This module is the single place where app code should choose fee rates,
 * mark prices, and execution prices from market data. Keeping the decisions
 * here prevents UI hooks from drifting away from the PDF/GMX invariants.
 */

export function getMarkPrice(priceData: PriceData): Price {
  return price((priceData.min + priceData.max) / 2);
}

export function getWorstClosePrice(
  direction: OrderDirection,
  priceData: PriceData,
): Price {
  return determineFillPrice(priceData.min, priceData.max, direction, true);
}

export function getExecutionPrice(
  direction: OrderDirection,
  priceData: PriceData,
  isClose: boolean,
): Price {
  return determineFillPrice(priceData.min, priceData.max, direction, isClose);
}

export function getPositionFeeBps(
  direction: OrderDirection,
  isClose: boolean,
  marketInfo: MarketInfo | undefined,
): BPS {
  if (!marketInfo) return DEFAULT_POSITION_FEE_BPS;

  return determinePositionFeeBps(
    direction,
    isClose,
    marketInfo.longOi,
    marketInfo.shortOi,
  );
}

export function getPositionFee(
  sizeUsd: USD,
  direction: OrderDirection,
  isClose: boolean,
  marketInfo: MarketInfo | undefined,
): { feeBps: BPS; feeUsd: USD } {
  const feeBps = getPositionFeeBps(direction, isClose, marketInfo);
  return {
    feeBps,
    feeUsd: calculatePositionFee(sizeUsd, feeBps),
  };
}

export function getBorrowRateForPosition(
  direction: OrderDirection,
  marketInfo: MarketInfo,
): number {
  const isSmallerSide =
    direction === "long"
      ? marketInfo.longOi < marketInfo.shortOi
      : marketInfo.shortOi < marketInfo.longOi;

  if (isSmallerSide) return 0;

  return direction === "long"
    ? marketInfo.borrowRateLong
    : marketInfo.borrowRateShort;
}

export function getFundingRateForPosition(
  direction: OrderDirection,
  marketInfo: MarketInfo,
): number {
  return direction === "long"
    ? marketInfo.fundingRateLong
    : marketInfo.fundingRateShort;
}

export function calculateFeeAccrualDelta(
  position: Position,
  marketInfo: MarketInfo,
  durationMs: number,
): FeeAccrualDelta {
  const borrowRatePerSecond = getBorrowRateForPosition(
    position.direction,
    marketInfo,
  );
  const fundingRatePerSecond = getFundingRateForPosition(
    position.direction,
    marketInfo,
  );

  return {
    borrowRatePerSecond,
    fundingRatePerSecond,
    borrowFeeDelta: calculateBorrowFee(
      position.sizeUsd,
      borrowRatePerSecond,
      durationMs,
    ),
    fundingFeeDelta: calculateFundingFee(
      position.sizeUsd,
      fundingRatePerSecond,
      durationMs,
    ),
  };
}

export function calculateHourlyBorrowFeeForPosition(
  position: Position,
  marketInfo: MarketInfo | undefined,
): USD {
  if (!marketInfo) return 0 as USD;

  return calculateBorrowFee(
    position.sizeUsd,
    getBorrowRateForPosition(position.direction, marketInfo),
    3_600_000,
  );
}

export function estimateExecutionFeeUsd(
  input: ExecutionFeeEstimateInput = {},
): USD {
  const gasLimit = input.gasLimit ?? 1_000_000;
  const gasPriceGwei = input.gasPriceGwei ?? 0.2;
  const ethPriceUsd = input.ethPriceUsd ?? 3_250;
  const ethCost = gasLimit * gasPriceGwei * 1e-9;

  return (ethCost * ethPriceUsd) as USD;
}

export function calculateMinimumCollateral(
  sizeUsd: USD,
  marketConfig: MarketConfig,
): USD {
  return ((sizeUsd * marketConfig.maintenanceMarginBps) / 10_000) as USD;
}

// ─── PnL Cap (MAX_PNL_FACTOR_FOR_TRADERS) ────────────────

/**
 * Get the maxPnlFactorForTraders for a market, falling back to the
 * on-chain default (0.5) when the field is missing or non-positive.
 *
 * GMX V2 caps positive trader PnL at `sizeUsd * maxPnlFactorForTraders`.
 * This protects the pool from paying out more than it can afford.
 * Negative PnL is never capped — traders always bear the full loss.
 */
export function getMaxPnlFactorForTraders(
  marketInfo: MarketInfo | undefined,
): number {
  if (!marketInfo) return DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS;
  if (
    typeof marketInfo.maxPnlFactorForTraders !== "number" ||
    !Number.isFinite(marketInfo.maxPnlFactorForTraders) ||
    marketInfo.maxPnlFactorForTraders <= 0
  ) {
    return DEFAULT_MAX_PNL_FACTOR_FOR_TRADERS;
  }
  return marketInfo.maxPnlFactorForTraders;
}

/**
 * Cap positive gross PnL at the market's maxPnlFactorForTraders threshold.
 *
 * GMX V2 invariant:
 *   if grossPnl > 0: cappedPnl = min(grossPnl, sizeUsd * maxPnlFactorForTraders)
 *   if grossPnl <= 0: no cap (full loss passes through)
 *
 * This must be applied BEFORE fee deduction in the settlement waterfall.
 *
 * @param grossPnl - Uncapped gross PnL
 * @param sizeUsd - Position size in USD
 * @param maxPnlFactor - Per-market factor (0.5 = 50% cap)
 * @returns Capped gross PnL
 */
export function capPositivePnl(
  grossPnl: USD,
  sizeUsd: USD,
  maxPnlFactor: number,
): USD {
  if (grossPnl <= 0) return grossPnl;
  const maxPnl = usd(sizeUsd * maxPnlFactor);
  return grossPnl > maxPnl ? maxPnl : grossPnl;
}

// ─── Balance-Improved Fee Classification ─────────────────

/**
 * Determine whether a trade improves the pool's OI balance using
 * the before/after imbalance delta — matching GMX V2's
 * `getBalanceWasImproved()` logic.
 *
 * Instead of the simple "which side is larger?" heuristic, this
 * computes the actual OI imbalance before and after the trade and
 * checks whether the trade reduces that imbalance.
 *
 * GMX V2 logic (from PnlHandler.sol / MarketUtils.sol):
 *   imbalanceBefore = |longOi - shortOi|
 *   imbalanceAfter  = |(longOi + deltaLong) - (shortOi + deltaShort)|
 *   balanceWasImproved = imbalanceAfter < imbalanceBefore
 *
 * Crossover case: If longs were larger but the trade makes shorts
 * larger, we check whether the *new* imbalance is smaller than the
 * *old* imbalance. This naturally handles the crossover correctly.
 *
 * @param direction - Trade direction
 * @param isClose - Whether this is a decrease/close
 * @param longOi - Current long OI
 * @param shortOi - Current short OI
 * @param sizeDeltaUsd - Size of the trade in USD
 * @returns true if the trade improves balance (→ 4 BPS), false if it worsens (→ 6 BPS)
 */
export function determineBalanceWasImproved(
  direction: OrderDirection,
  isClose: boolean,
  longOi: USD,
  shortOi: USD,
  sizeDeltaUsd: USD,
): boolean {
  // Compute the OI delta for each side
  const absDelta = Math.abs(sizeDeltaUsd);
  const deltaLong = direction === "long" ? (isClose ? -absDelta : absDelta) : 0;
  const deltaShort = direction === "short" ? (isClose ? -absDelta : absDelta) : 0;

  const imbalanceBefore = Math.abs(longOi - shortOi);
  const imbalanceAfter = Math.abs(
    (longOi + deltaLong) - (shortOi + deltaShort),
  );

  return imbalanceAfter < imbalanceBefore;
}

/**
 * Determine position fee BPS using the balanceWasImproved delta logic.
 *
 * This replaces the simpler side-heuristic in determinePositionFeeBps()
 * with GMX V2's actual before/after imbalance comparison. Falls back to
 * the simple heuristic when sizeDeltaUsd is not available (zero).
 */
export function determinePositionFeeBpsFromDelta(
  direction: OrderDirection,
  isClose: boolean,
  longOi: USD,
  shortOi: USD,
  sizeDeltaUsd: USD,
): BPS {
  // Fallback to the simple side-based heuristic when we have no trade size
  if (sizeDeltaUsd <= 0) {
    return determinePositionFeeBps(direction, isClose, longOi, shortOi);
  }

  const wasImproved = determineBalanceWasImproved(
    direction,
    isClose,
    longOi,
    shortOi,
    sizeDeltaUsd,
  );

  return wasImproved ? POSITION_FEE_BALANCING_BPS : POSITION_FEE_IMBALANCING_BPS;
}

/**
 * Get position fee BPS using the delta-based classification when
 * sizeDeltaUsd is available, falling back to the side-heuristic
 * when market info is missing.
 */
export function getPositionFeeBpsWithDelta(
  direction: OrderDirection,
  isClose: boolean,
  marketInfo: MarketInfo | undefined,
  sizeDeltaUsd: USD | undefined,
): BPS {
  if (!marketInfo) return DEFAULT_POSITION_FEE_BPS;

  if (sizeDeltaUsd !== undefined && sizeDeltaUsd > 0) {
    return determinePositionFeeBpsFromDelta(
      direction,
      isClose,
      marketInfo.longOi,
      marketInfo.shortOi,
      sizeDeltaUsd,
    );
  }

  // Backward-compatible fallback: use the simple side heuristic
  return determinePositionFeeBps(
    direction,
    isClose,
    marketInfo.longOi,
    marketInfo.shortOi,
  );
}

// ─── Close Settlement Waterfall ──────────────────────────

/**
 * Ordered close settlement result — reflects the GMX V2 waterfall:
 *   1. Realize gross PnL (with positive PnL cap)
 *   2. Deduct position fee from open (already deducted from effective collateral)
 *   3. Deduct funding fees accrued
 *   4. Deduct borrow fees accrued
 *   5. Deduct position fee (close)
 *   6. Return remaining collateral (floored at zero)
 *
 * Each step's remaining value is shown so the trade history can
 * display the ordered flow instead of a single net number.
 */
export interface CloseSettlement {
  /** Gross PnL before any caps */
  grossPnlUncapped: USD;
  /** Gross PnL after positive-PnL cap (this is what's actually realized) */
  grossPnl: USD;
  /** PnL cap amount clipped off (0 if not capped) */
  pnlCappedAmount: USD;
  /** Collateral after realizing capped PnL: collateral + grossPnl */
  collateralAfterPnl: USD;
  /** Collateral after deducting open position fee */
  collateralAfterOpenFee: USD;
  /** Collateral after deducting funding fees */
  collateralAfterFunding: USD;
  /** Collateral after deducting borrow fees */
  collateralAfterBorrow: USD;
  /** Collateral after deducting close position fee */
  collateralAfterCloseFee: USD;
  /** Final returned collateral (collateralAfterCloseFee, floored at 0) */
  returnedCollateral: USD;
  /** Net PnL after all deductions (for trade history) */
  netPnl: USD;
  /** Position fee at close */
  positionFeeClose: USD;
  /** Total borrow fees accrued */
  borrowFeeTotal: USD;
  /** Total funding fees accrued */
  fundingFeeTotal: USD;
}

/**
 * Execute the GMX V2 close/decrease settlement waterfall.
 *
 * This makes the settlement ordering explicit: PnL is realized first,
 * then fees are deducted in a specific order. The returned collateral
 * is what remains after all deductions, floored at zero.
 *
 * This replaces the simple `calculateClosePosition` for new code
 * that needs waterfall visibility. The old function remains for
 * backward compatibility.
 */
export function calculateCloseSettlement(
  direction: OrderDirection,
  entryPrice: Price,
  exitPrice: Price,
  sizeUsd: USD,
  collateralUsd: USD,
  positionFeeOpen: USD,
  positionFeeCloseBps: BPS,
  borrowFeeAccrued: USD,
  fundingFeeAccrued: USD,
  maxPnlFactor: number,
  sizeInTokens?: number,
): CloseSettlement {
  // Step 1: Compute uncapped gross PnL
  const grossPnlUncapped = calculateGrossPnl(
    direction,
    entryPrice,
    exitPrice,
    sizeUsd,
    sizeInTokens,
  );

  // Step 2: Cap positive PnL
  const grossPnl = capPositivePnl(grossPnlUncapped, sizeUsd, maxPnlFactor);
  const pnlCappedAmount = usd(
    grossPnlUncapped > 0 ? grossPnlUncapped - grossPnl : 0,
  );

  // Step 3: Realize PnL into collateral
  const collateralAfterPnl = usd(collateralUsd + grossPnl);

  // Step 4: Deduct open position fee (was deducted from effective
  // collateral at open time in GMX V2 — reflected here in the waterfall)
  const collateralAfterOpenFee = usd(collateralAfterPnl - positionFeeOpen);

  // Step 5: Deduct funding fees
  const collateralAfterFunding = usd(collateralAfterOpenFee - fundingFeeAccrued);

  // Step 6: Deduct borrow fees
  const collateralAfterBorrow = usd(collateralAfterFunding - borrowFeeAccrued);

  // Step 7: Deduct close position fee
  const positionFeeClose = calculatePositionFee(sizeUsd, positionFeeCloseBps);
  const collateralAfterCloseFee = usd(collateralAfterBorrow - positionFeeClose);

  // Step 8: Floor at zero
  const returnedCollateral = usd(Math.max(0, collateralAfterCloseFee));

  // Net PnL for trade history — this is the total P&L from the trade
  // including all fees: grossPnl - positionFeeOpen - positionFeeClose -
  // borrowFeeAccrued - fundingFeeAccrued. Note: this does NOT include
  // collateralUsd (which is the trader's own capital, not P&L).
  // This matches calculateClosePosition's netPnl computation.
  const netPnl = usd(
    grossPnl - positionFeeOpen - positionFeeClose - fundingFeeAccrued - borrowFeeAccrued,
  );

  return {
    grossPnlUncapped,
    grossPnl,
    pnlCappedAmount,
    collateralAfterPnl,
    collateralAfterOpenFee,
    collateralAfterFunding,
    collateralAfterBorrow,
    collateralAfterCloseFee,
    returnedCollateral,
    netPnl,
    positionFeeClose,
    borrowFeeTotal: borrowFeeAccrued,
    fundingFeeTotal: fundingFeeAccrued,
  };
}
