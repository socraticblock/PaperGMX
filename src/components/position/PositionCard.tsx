"use client";

import { memo, useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import type { Position, MarketSlug, PriceData, MarketInfo } from "@/types";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice, formatPercent, formatDuration } from "@/lib/format";
import { usd } from "@/lib/branded";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  FireIcon,
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

function PositionCardInner({ position, prices }: PositionCardProps) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";
  const pnl = usePositionPnl(position, prices);
  const timeSinceOpen = useTimeSinceOpen(position);

  // Total fees
  const totalFees = useMemo(
    () => usd(position.positionFeePaid + position.borrowFeeAccrued + position.fundingFeeAccrued),
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
            Fees: <span className="text-red-primary">-{formatUSD(totalFees)}</span>
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
            pnl.currentPrice > 0
              ? `$${formatPrice(pnl.currentPrice, marketConfig.decimals)}`
              : "—"
          }
          valueColor={pnlColorClass}
        />
        <StatRow
          label="Liquidation Price"
          value={`$${formatPrice(position.liquidationPrice, marketConfig.decimals)}`}
          valueColor={liqColorClass}
          tooltip="Price at which your position is liquidated"
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

      {/* ─── Liquidation Warning ─────────────────────────── */}
      {pnl.distanceToLiq < 15 && pnl.distanceToLiq > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 ${
            pnl.distanceToLiq < 5
              ? "bg-red-primary/10 border border-red-primary/30"
              : "bg-yellow-primary/10 border border-yellow-primary/30"
          }`}
        >
          <FireIcon
            className={`h-4 w-4 flex-shrink-0 ${
              pnl.distanceToLiq < 5 ? "text-red-primary" : "text-yellow-primary"
            }`}
            aria-hidden="true"
          />
          <p
            className={`text-[10px] leading-relaxed ${
              pnl.distanceToLiq < 5 ? "text-red-primary" : "text-yellow-primary"
            }`}
          >
            {pnl.distanceToLiq < 5
              ? "Close to liquidation! Consider cutting your loss."
              : "Position approaching liquidation zone."}
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}

export const PositionCard = memo(PositionCardInner);
export default PositionCard;
