"use client";

import { memo, useCallback } from "react";
import { motion } from "framer-motion";
import type {
  Position,
  MarketSlug,
  PriceData,
  MarketInfo,
} from "@/types";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice, formatPercent } from "@/lib/format";
import {
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "@heroicons/react/24/outline";

// ─── Props ───────────────────────────────────────────────

export interface PositionsListProps {
  positions: Position[];
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
  selectedPositionId: string | null;
  onSelect: (id: string) => void;
}

// ─── Single row ──────────────────────────────────────────

interface PositionRowProps {
  position: Position;
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const PositionRow = memo(function PositionRow({
  position,
  prices,
  marketInfo,
  isSelected,
  onSelect,
}: PositionRowProps) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";
  const pnl = usePositionPnl(position, prices, marketInfo);
  const isConfirming = position.status === "confirming";

  const pnlColorClass =
    pnl.netPnl >= 0 ? "text-green-primary" : "text-red-primary";

  const handleClick = useCallback(() => {
    onSelect(position.id);
  }, [onSelect, position.id]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
        isSelected
          ? "border-blue-primary bg-trade-raised"
          : "border-trade-border-subtle bg-trade-panel hover:border-trade-border-active"
      }`}
      aria-pressed={isSelected}
      aria-label={`Select ${marketConfig.symbol} ${isLong ? "long" : "short"} position`}
    >
      {/* Top row: badge + market + PnL */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              isLong
                ? "bg-green-primary/20 text-green-primary"
                : "bg-red-primary/20 text-red-primary"
            }`}
          >
            {isLong ? (
              <ArrowTrendingUpIcon className="h-2.5 w-2.5" aria-hidden="true" />
            ) : (
              <ArrowTrendingDownIcon
                className="h-2.5 w-2.5"
                aria-hidden="true"
              />
            )}
            {isLong ? "LONG" : "SHORT"}
          </span>
          <span className="truncate text-xs font-semibold text-text-primary">
            {marketConfig.pair}
          </span>
          <span className="shrink-0 text-[10px] text-text-muted">
            {position.leverage.toFixed(1)}x
          </span>
          {isConfirming && (
            <span className="shrink-0 rounded bg-yellow-primary/20 px-1 py-px text-[9px] font-medium uppercase text-yellow-primary">
              Confirming
            </span>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-mono font-semibold ${pnlColorClass}`}
          title="Unrealized net P&L (after est. close fees and accrued borrow/funding)"
        >
          {formatUSD(pnl.netPnl)}
        </span>
      </div>

      {/* Bottom row: size / margin / entry / mark */}
      <div className="mt-1 grid grid-cols-4 gap-2 text-[10px] tabular-nums">
        <Cell label="Size" value={formatUSD(position.sizeUsd)} />
        <Cell label="Margin" value={formatUSD(position.collateralUsd)} />
        <Cell
          label="Entry"
          value={formatPrice(position.entryPrice, marketConfig.decimals)}
        />
        <Cell
          label="Mark"
          value={
            pnl.currentPrice && pnl.currentPrice > 0
              ? formatPrice(pnl.currentPrice, marketConfig.decimals)
              : "—"
          }
        />
      </div>

      {/* Distance to liq */}
      <div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
        <span>Distance to liq.</span>
        <span
          className={`tabular-nums ${
            pnl.distanceToLiq < 5
              ? "text-red-primary"
              : pnl.distanceToLiq < 15
                ? "text-yellow-primary"
                : "text-text-secondary"
          }`}
        >
          {formatPercent(pnl.distanceToLiq)}
        </span>
      </div>
    </motion.button>
  );
});

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-text-muted">{label}</span>
      <span className="font-medium text-text-primary">{value}</span>
    </div>
  );
}

// ─── List ────────────────────────────────────────────────

function PositionsListInner({
  positions,
  prices,
  marketInfo,
  selectedPositionId,
  onSelect,
}: PositionsListProps) {
  if (positions.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
        Open positions ({positions.length})
      </p>
      <div className="space-y-1.5">
        {positions.map((p) => (
          <PositionRow
            key={p.id}
            position={p}
            prices={prices}
            marketInfo={marketInfo}
            isSelected={p.id === selectedPositionId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export const PositionsList = memo(PositionsListInner);
export default PositionsList;

// ─── Connected variant — pulls store + selection automatically ────

export const ConnectedPositionsList = memo(function ConnectedPositionsList() {
  const { positions, selectedPositionId, prices, marketInfo, selectPosition } =
    usePaperStore(
      useShallow((s) => ({
        positions: s.positions,
        selectedPositionId: s.selectedPositionId,
        prices: s.prices,
        marketInfo: s.marketInfo,
        selectPosition: s.selectPosition,
      })),
    );
  return (
    <PositionsList
      positions={positions}
      prices={prices}
      marketInfo={marketInfo}
      selectedPositionId={selectedPositionId}
      onSelect={selectPosition}
    />
  );
});
