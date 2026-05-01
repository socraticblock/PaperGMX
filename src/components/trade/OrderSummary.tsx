"use client";

import { memo, useMemo } from "react";
import type {
  OrderDirection,
  USD,
  BPS,
  MarketSlug,
  PriceData,
  MarketInfo,
} from "@/types";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateHourlyBorrowFee,
  calculateLiquidationPrice,
  calculateAcceptablePrice,
  determineFillPrice,
} from "@/lib/calculations";
import { usd } from "@/lib/branded";
import { formatUSD, formatPrice, formatPercent } from "@/lib/format";
import {
  MARKETS,
  DEFAULT_POSITION_FEE_BPS,
  SLIPPAGE_OPEN_BPS,
} from "@/lib/constants";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface OrderSummaryProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
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
}: OrderSummaryProps) {
  const marketConfig = MARKETS[market];

  // ─── All calculations are derived from pure functions ────
  const calculations = useMemo(() => {
    // If no price data, return null
    if (!priceData || priceData.last <= 0) return null;
    // If no collateral entered, can't calculate position values
    if (collateralUsd <= 0) return null;

    const sizeUsd = calculatePositionSize(collateralUsd, leverage);
    const feeBps: BPS = marketInfo?.positionFeeBps ?? DEFAULT_POSITION_FEE_BPS;
    const positionFee = calculatePositionFee(sizeUsd, feeBps);

    // Fill price (worst oracle price for trader)
    const fillPrice = determineFillPrice(
      priceData.min,
      priceData.max,
      direction,
      false, // not a close
    );

    // Acceptable price with slippage
    const acceptablePrice = calculateAcceptablePrice(
      fillPrice,
      SLIPPAGE_OPEN_BPS,
      direction,
      false,
    );

    // Liquidation price (at entry, no accrued fees)
    const maintenanceMarginBps = marketConfig.maintenanceMarginBps;
    const liquidationPrice = calculateLiquidationPrice(
      direction,
      fillPrice,
      collateralUsd,
      sizeUsd,
      maintenanceMarginBps,
      positionFee, // Position fee reduces effective collateral
      usd(0), // No accrued fees at open
    );

    // Hourly borrow fee estimate
    const borrowRate =
      direction === "long"
        ? (marketInfo?.borrowRateLong ?? 0)
        : (marketInfo?.borrowRateShort ?? 0);
    const hourlyBorrowFee = calculateHourlyBorrowFee(sizeUsd, borrowRate);

    // Spread percentage
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
      spread,
      feeBps,
    };
  }, [
    collateralUsd,
    leverage,
    direction,
    priceData,
    marketInfo,
    marketConfig.maintenanceMarginBps,
  ]);

  // ─── Loading state ──────────────────────────────────────
  if (!calculations) {
    const reason =
      !priceData || priceData.last <= 0
        ? "Waiting for price data..."
        : collateralUsd <= 0
          ? "Enter collateral to see order details"
          : null;

    return (
      <div className="rounded-xl border border-border-primary bg-bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">
          Order Summary
        </h3>
        <div className="space-y-2">
          {reason ? (
            <p className="text-xs text-text-muted text-center py-3">{reason}</p>
          ) : (
            [1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-3 w-20 animate-pulse rounded bg-bg-input" />
                <div className="h-3 w-16 animate-pulse rounded bg-bg-input" />
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const liqDistancePercent =
    calculations.fillPrice > 0
      ? Math.abs(
          ((calculations.liquidationPrice - calculations.fillPrice) /
            calculations.fillPrice) *
            100,
        )
      : 0;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">
        Order Summary
      </h3>

      <div className="space-y-0 divide-y divide-border-primary/50">
        {/* Position Size */}
        <SummaryRow
          label="Position Size"
          value={formatUSD(calculations.sizeUsd)}
          tooltip={`${collateralUsd.toFixed(2)} × ${leverage}x leverage`}
        />

        {/* Entry Price (Fill) */}
        <SummaryRow
          label="Est. Entry Price"
          value={`$${formatPrice(calculations.fillPrice, marketConfig.decimals)}`}
          tooltip="Worst oracle price for your direction"
        />

        {/* Acceptable Price */}
        <SummaryRow
          label="Acceptable Price"
          value={`$${formatPrice(calculations.acceptablePrice, marketConfig.decimals)}`}
          tooltip="Max slippage: 0.5% from entry"
        />

        {/* Liquidation Price */}
        <SummaryRow
          label="Liq. Price"
          value={`$${formatPrice(calculations.liquidationPrice, marketConfig.decimals)}`}
          tooltip={`-${liqDistancePercent.toFixed(1)}% from entry`}
          valueColor={
            liqDistancePercent < 10
              ? "text-red-primary"
              : liqDistancePercent < 25
                ? "text-yellow-primary"
                : "text-text-primary"
          }
        />

        {/* Position Fee */}
        <SummaryRow
          label="Position Fee"
          value={formatUSD(calculations.positionFee)}
          tooltip={`${calculations.feeBps} BPS (${(calculations.feeBps / 100).toFixed(2)}%) of position size`}
        />

        {/* Hourly Borrow */}
        <SummaryRow
          label="Est. Borrow (1h)"
          value={formatUSD(calculations.hourlyBorrowFee)}
          tooltip="Based on current borrow rate. May change."
        />

        {/* Oracle Spread */}
        <SummaryRow
          label="Oracle Spread"
          value={formatPercent(calculations.spread)}
          tooltip="Difference between min/max oracle prices"
        />

        {/* Total Cost (spec 3.4) */}
        <SummaryRow
          label="Total Cost"
          value={formatUSD(collateralUsd + calculations.positionFee)}
          tooltip={`Collateral (${formatUSD(collateralUsd)}) + Position Fee (${formatUSD(calculations.positionFee)})`}
          valueColor="text-text-primary"
        />
      </div>

      {/* Disclaimer banner (spec 3.12) */}
      <div className="mt-3 rounded-lg border border-border-primary/50 bg-bg-input px-3 py-2">
        <p className="text-[10px] text-text-muted leading-relaxed text-center">
          This is a simulation. Same prices & fees as GMX V2, no real risk.
        </p>
      </div>
    </div>
  );
}

export const OrderSummary = memo(OrderSummaryInner);
export default OrderSummary;
