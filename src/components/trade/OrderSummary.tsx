"use client";

import { memo, useMemo } from "react";
import type {
  EntryOrderType,
  OrderDirection,
  USD,
  MarketSlug,
  PriceData,
  MarketInfo,
  Price,
} from "@/types";
import {
  calculatePositionSize,
  calculateHourlyBorrowFee,
  calculateLiquidationPrice,
  calculateAcceptablePrice,
  calculatePositionFee,
} from "@/lib/calculations";
import {
  estimateExecutionFeeUsd,
  getBorrowRateForPosition,
  getExecutionPrice,
  getPositionFeeBpsWithDelta,
} from "@/lib/positionEngine";
import { usd } from "@/lib/branded";
import { formatUSD, formatPrice, formatPercent } from "@/lib/format";
import { MARKETS, SLIPPAGE_OPEN_BPS } from "@/lib/constants";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface OrderSummaryProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  /** Market uses oracle execution prices; limit uses `limitEntryPrice` as hypothetical fill for previews. */
  entryOrderType: EntryOrderType;
  /** Required when `entryOrderType === 'limit'` — hypothetical entry for liquidation & fee sizing. */
  limitEntryPrice: Price | null;
}

// ─── Summary Row ──────────────────────────────────────────

interface SummaryRowProps {
  label: string;
  value: string;
  tooltip?: string;
  valueColor?: string;
}

function SummaryRow({ label, value, tooltip, valueColor }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-1">
        <span className="text-xs text-text-muted">{label}</span>
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <InformationCircleIcon
              className="h-3 w-3 text-text-muted/60"
              aria-hidden="true"
            />
          </span>
        )}
      </div>
      <span
        className={`text-xs font-medium ${valueColor ?? "text-text-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────

function OrderSummaryInner({
  direction,
  collateralUsd,
  leverage,
  market,
  priceData,
  marketInfo,
  entryOrderType,
  limitEntryPrice,
}: OrderSummaryProps) {
  const marketConfig = MARKETS[market];

  // ─── All calculations are derived from pure functions ────
  const calculations = useMemo(() => {
    // If no price data, return null
    if (!priceData || priceData.last <= 0) return null;
    // If no collateral entered, can't calculate position values
    if (collateralUsd <= 0) return null;
    if (entryOrderType === "limit" && limitEntryPrice == null) return null;

    const sizeUsd = calculatePositionSize(collateralUsd, leverage);
    // GMX V2: position fee BPS depends on whether the trade balances or
    // imbalances pool OI. We compute it from the current OI data.
    const feeBps = getPositionFeeBpsWithDelta(
      direction,
      false,
      marketInfo,
      sizeUsd,
    );
    const positionFee = calculatePositionFee(sizeUsd, feeBps);

    // Hypothetical entry: oracle worst-case (market) vs user limit (limit preview only)
    const fillPrice =
      entryOrderType === "limit" && limitEntryPrice != null
        ? limitEntryPrice
        : getExecutionPrice(direction, priceData, false);

    // Acceptable price with slippage — anchored to the same hypothetical entry
    const acceptablePrice = calculateAcceptablePrice(
      fillPrice,
      SLIPPAGE_OPEN_BPS,
      direction,
      false,
    );

    // Liquidation price (at entry, no accrued fees) — uses same fill as preview
    const maintenanceMarginBps = marketConfig.maintenanceMarginBps;
    const liquidationFeeBps = marketConfig.liquidationFeeBps;
    const liquidationPrice = calculateLiquidationPrice(
      direction,
      fillPrice,
      collateralUsd,
      sizeUsd,
      maintenanceMarginBps,
      liquidationFeeBps,
      positionFee, // Position fee reduces effective collateral
      usd(0), // No accrued fees at open
    );

    // Hourly borrow fee estimate
    const borrowRate = marketInfo
      ? getBorrowRateForPosition(direction, marketInfo)
      : 0;
    const hourlyBorrowFee = calculateHourlyBorrowFee(sizeUsd, borrowRate);
    const executionFee = estimateExecutionFeeUsd();

    // Spread percentage (oracle liquidity — still relevant context for limit preview)
    const spread =
      priceData.max > 0 && priceData.min > 0
        ? ((priceData.max - priceData.min) /
            ((priceData.max + priceData.min) / 2)) *
          100
        : 0;

    return {
      sizeUsd,
      positionFee,
      fillPrice,
      acceptablePrice,
      liquidationPrice,
      hourlyBorrowFee,
      executionFee,
      spread,
      feeBps,
      isLimitPreview: entryOrderType === "limit",
    };
  }, [
    collateralUsd,
    leverage,
    direction,
    priceData,
    marketInfo,
    marketConfig.maintenanceMarginBps,
    marketConfig.liquidationFeeBps,
    entryOrderType,
    limitEntryPrice,
  ]);

  // ─── Loading state ──────────────────────────────────────
  if (!calculations) {
    const reason =
      !priceData || priceData.last <= 0
        ? "Waiting for price data..."
        : collateralUsd <= 0
          ? "Enter margin to see trade estimates"
          : entryOrderType === "limit" && limitEntryPrice == null
            ? "Enter a limit price for liquidation & fee previews"
            : null;

    return (
      <div className="rounded-lg border border-trade-border-subtle bg-trade-panel px-3 py-3">
        {reason ? (
          <p className="text-center text-[length:var(--text-trade-body)] text-text-muted">
            {reason}
          </p>
        ) : (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-trade-raised" />
                <div className="h-3 w-16 animate-pulse rounded bg-trade-raised" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const liqDistancePercent =
    calculations.liquidationPrice !== null && calculations.liquidationPrice > 0 && calculations.fillPrice > 0
      ? Math.abs(
          ((calculations.liquidationPrice - calculations.fillPrice) /
            calculations.fillPrice) *
            100,
        )
      : 0;

  // For overcollateralized positions, liquidation price is null — display "N/A"
  const liqPriceDisplay =
    calculations.liquidationPrice !== null
      ? `$${formatPrice(calculations.liquidationPrice, marketConfig.decimals)}`
      : "N/A (overcollateralized)";

  const feePercentOfSize = (calculations.feeBps / 100).toFixed(3);
  const impactFeesDisplay = `${formatPercent(calculations.spread)} / ${feePercentOfSize}%`;

  return (
    <div className="space-y-3">
      {/* GMX-style always-visible strip */}
      <div className="space-y-2 rounded-lg border border-trade-border-subtle bg-trade-raised/35 px-3 py-2">
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[length:var(--text-trade-body)] text-text-muted">
            Liquidation price
          </span>
          <span
            className={`text-right text-[length:var(--text-trade-body)] font-medium tabular-nums ${
              calculations.liquidationPrice === null
                ? "text-text-muted"
                : liqDistancePercent < 10
                  ? "text-red-primary"
                  : liqDistancePercent < 25
                    ? "text-yellow-primary"
                    : "text-text-primary"
            }`}
          >
            {liqPriceDisplay}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 py-1">
          <span className="text-[length:var(--text-trade-body)] text-text-muted">
            Price impact / fees
          </span>
          <span className="text-[length:var(--text-trade-body)] font-medium tabular-nums text-text-primary">
            {impactFeesDisplay}
          </span>
        </div>
      </div>

      <details className="group rounded-lg border border-trade-border-subtle bg-trade-panel open:bg-trade-raised/25">
        <summary className="cursor-pointer px-3 py-2 text-[length:var(--text-trade-body)] font-medium text-text-secondary [&::-webkit-details-marker]:hidden">
          Execution details
        </summary>
        <div className="space-y-0 divide-y divide-trade-border-subtle border-t border-trade-border-subtle px-3 py-1">
          <SummaryRow
            label="Position size"
            value={formatUSD(calculations.sizeUsd)}
            tooltip={`${collateralUsd.toFixed(2)} × ${leverage}x leverage`}
          />
          <SummaryRow
            label={
              calculations.isLimitPreview
                ? "Hypothetical entry (limit)"
                : "Est. entry price"
            }
            value={`$${formatPrice(calculations.fillPrice, marketConfig.decimals)}`}
            tooltip={
              calculations.isLimitPreview
                ? "Preview at your limit price — execution is still market-only in this build"
                : "Worst oracle price for your direction"
            }
          />
          <SummaryRow
            label="Acceptable price"
            value={`$${formatPrice(calculations.acceptablePrice, marketConfig.decimals)}`}
            tooltip="Max slippage: 0.5% from entry"
          />
          <SummaryRow
            label="Position fee"
            value={formatUSD(calculations.positionFee)}
            tooltip={`${calculations.feeBps} BPS (${feePercentOfSize}%) of position size`}
          />
          <SummaryRow
            label="Est. borrow (1h)"
            value={formatUSD(calculations.hourlyBorrowFee)}
            tooltip="Based on current borrow rate. May change."
          />
          <SummaryRow
            label="Est. gas"
            value={`~${formatUSD(calculations.executionFee)}`}
            tooltip="Shown for GMX fidelity only; paper balance is not charged."
          />
          <SummaryRow
            label="Oracle spread"
            value={formatPercent(calculations.spread)}
            tooltip="Difference between min/max oracle prices"
          />
          <SummaryRow
            label="Total cost"
            value={formatUSD(collateralUsd)}
            tooltip={`Margin required. Position fee (${formatUSD(calculations.positionFee)}) is deducted from collateral in the sim.`}
            valueColor="text-text-primary"
          />
        </div>
      </details>

      <div className="rounded-md border border-trade-border-subtle bg-trade-strip px-3 py-2">
        <p className="text-center text-[length:var(--text-trade-label)] leading-relaxed text-text-muted">
          {calculations.isLimitPreview ? (
            <>
              Limit previews use your price for math only — orders still execute as{" "}
              <span className="text-text-secondary">market</span> when you submit.
            </>
          ) : (
            <>Simulation only — same mechanics as GMX V2, no real funds at risk.</>
          )}
        </p>
      </div>
    </div>
  );
}

export const OrderSummary = memo(OrderSummaryInner);
export default OrderSummary;
