"use client";

import { memo, useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Position, MarketSlug, PriceData, MarketInfo } from "@/types";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import { MarginWarning } from "@/components/position/MarginWarning";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice, formatPercent, formatDuration } from "@/lib/format";
import { addUSD } from "@/lib/branded";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// ─── Props ───────────────────────────────────────────────

export interface PositionCardProps {
  position: Position;
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
}

// ─── Sub-components ──────────────────────────────────────

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
  tooltip?: string;
}

function StatRow({ label, value, valueColor, tooltip }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-muted">{label}</span>
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <span className="text-[9px] text-text-muted/60">ⓘ</span>
          </span>
        )}
      </div>
      <span className={`text-[11px] font-mono font-medium ${valueColor ?? "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Time Since Hook (keeps "time since opened" ticking) ──

function useTimeSinceOpen(position: Position): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60_000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return useMemo(() => {
    const confirmedAt = position.confirmedAt ?? position.openedAt;
    return formatDuration(now - confirmedAt);
  }, [now, position.confirmedAt, position.openedAt]);
}

// ─── Main Component ──────────────────────────────────────

function PositionCardInner({ position, prices, marketInfo }: PositionCardProps) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";
  const pnl = usePositionPnl(position, prices, marketInfo);
  const timeSinceOpen = useTimeSinceOpen(position);

  // Total fees — use addUSD for NaN/Infinity safety instead of raw +
  const totalFees = useMemo(
    () => addUSD(addUSD(position.positionFeePaid, position.borrowFeeAccrued), position.fundingFeeAccrued),
    [position.positionFeePaid, position.borrowFeeAccrued, position.fundingFeeAccrued]
  );

  // P&L color classes
  const pnlIsPositive = pnl.netPnl >= 0;
  const pnlColorClass = pnlIsPositive ? "text-green-primary" : "text-red-primary";

  // Distance to liq color
  const liqColorClass =
    pnl.distanceToLiq < 5
      ? "text-red-primary"
      : pnl.distanceToLiq < 15
      ? "text-yellow-primary"
      : "text-text-primary";

  // Confirming state
  const isConfirming = position.status === "confirming";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="space-y-4"
    >
      {/* ─── Margin Warning Banner ─────────────────────── */}
      <MarginWarning
        position={position}
        distanceToLiq={pnl.distanceToLiq}
        prices={prices}
        recalculatedLiqPrice={pnl.recalculatedLiqPrice}
      />

      {/* ─── Header: Direction + Market ──────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold ${
              isLong
                ? "bg-green-primary/20 text-green-primary"
                : "bg-red-primary/20 text-red-primary"
            }`}
          >
            {isLong ? (
              <ArrowTrendingUpIcon className="h-3 w-3" aria-hidden="true" />
            ) : (
              <ArrowTrendingDownIcon className="h-3 w-3" aria-hidden="true" />
            )}
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="text-sm font-semibold text-text-primary">
            {marketConfig.pair}
          </span>
        </div>

        {isConfirming && (
          <span className="flex items-center gap-1 rounded-md bg-yellow-primary/20 px-2 py-0.5 text-[10px] font-medium text-yellow-primary">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-yellow-primary" />
            Confirming...
          </span>
        )}
      </div>

      {/* ─── P&L Display (Hero Number) ───────────────────── */}
      <div className="rounded-xl bg-bg-input p-4 text-center">
        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">
          Net P&amp;L
        </p>
        <p className={`text-2xl font-bold font-mono ${pnlColorClass}`}>
          {formatUSD(pnl.netPnl)}
        </p>
        <p className={`text-xs font-mono mt-0.5 ${pnlColorClass}`}>
          {formatPercent(pnl.pnlPercent)}
        </p>

        {/* Mini breakdown */}
        <div className="mt-2 flex items-center justify-center gap-3 text-[10px]">
          <span className="text-text-muted">
            Gross: <span className={pnlColorClass}>{formatUSD(pnl.grossPnl)}</span>
          </span>
          <span className="text-border-primary">|</span>
          <span className="text-text-muted">
            Fees (net):{" "}
            <span
              className={
                totalFees > 0 ? "text-red-primary" : "text-green-primary"
              }
            >
              {formatUSD(totalFees)}
            </span>
          </span>
        </div>
      </div>

      {/* ─── Position Details ────────────────────────────── */}
      <div className="space-y-0 divide-y divide-border-primary/30">
        <StatRow
          label="Entry Price"
          value={`$${formatPrice(position.entryPrice, marketConfig.decimals)}`}
        />
        <StatRow
          label="Current Price"
          value={
            pnl.currentPrice && pnl.currentPrice > 0
              ? `$${formatPrice(pnl.currentPrice, marketConfig.decimals)}`
              : "—"
          }
          valueColor={pnlColorClass}
        />
        <StatRow
          label="Liquidation Price"
          value={
            pnl.recalculatedLiqPrice
              ? `$${formatPrice(pnl.recalculatedLiqPrice, marketConfig.decimals)}`
              : position.liquidationPrice
                ? `$${formatPrice(position.liquidationPrice, marketConfig.decimals)}`
                : "N/A"
          }
          valueColor={liqColorClass}
          tooltip="Price at which your position is liquidated (recalculated with fees)"
        />
        <StatRow
          label="Distance to Liq."
          value={formatPercent(pnl.distanceToLiq)}
          valueColor={liqColorClass}
        />
        <StatRow
          label="Position Size"
          value={formatUSD(position.sizeUsd)}
        />
        <StatRow
          label="Collateral"
          value={formatUSD(position.collateralUsd)}
        />
        <StatRow
          label="Leverage"
          value={`${position.leverage}x`}
          valueColor="text-blue-primary"
        />
      </div>

      {/* ─── Fee Breakdown ───────────────────────────────── */}
      <div>
        <p className="text-[10px] uppercase tracking-wider text-text-muted mb-2">
          Fee Breakdown
        </p>
        <div className="rounded-lg bg-bg-input px-3 py-2 space-y-0 divide-y divide-border-primary/20">
          <StatRow
            label="Position Fee (Open)"
            value={formatUSD(position.positionFeePaid)}
            tooltip={`${position.positionFeeBps} BPS of position size`}
          />
          <StatRow
            label="Borrow Fee (Accrued)"
            value={formatUSD(position.borrowFeeAccrued)}
            tooltip="Accumulated borrow fee since position opened"
          />
          <StatRow
            label="Funding Fee (Accrued)"
            value={formatUSD(position.fundingFeeAccrued)}
            tooltip="Accumulated funding fee (positive = you pay, negative = you receive)"
          />
          <StatRow
            label="Total Fees"
            value={formatUSD(totalFees)}
            valueColor="text-red-primary"
          />
        </div>
      </div>

      {/* ─── Time Since Opened ───────────────────────────── */}
      <div className="flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1 text-text-muted">
          <ClockIcon className="h-3 w-3" aria-hidden="true" />
          <span>Opened</span>
        </div>
        <span className="text-text-secondary font-mono">{timeSinceOpen}</span>
      </div>
    </motion.div>
  );
}

export const PositionCard = memo(PositionCardInner);
export default PositionCard;
