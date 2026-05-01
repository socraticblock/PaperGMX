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
import { price } from "@/lib/branded";
import {
  calculateBorrowFee,
  calculateFundingFee,
  calculatePositionFee,
  determineFillPrice,
  determinePositionFeeBps,
} from "@/lib/calculations";
import { DEFAULT_POSITION_FEE_BPS } from "@/lib/constants";

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
