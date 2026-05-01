"use client";

import { memo, useMemo } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { MARKETS } from "@/lib/constants";
import { formatPrice, formatUSDCompact, formatPercent } from "@/lib/format";
import type { MarketSlug } from "@/types";
import { motion } from "framer-motion";

export interface MarketCardProps {
  slug: MarketSlug;
  onClick: (slug: MarketSlug) => void;
}

function MarketCardInner({ slug, onClick }: MarketCardProps) {
  const market = MARKETS[slug];
  const priceData = usePaperStore(useShallow((s) => s.prices[slug]));
  const info = usePaperStore(useShallow((s) => s.marketInfo[slug]));
  const hasPosition = usePaperStore(
    useShallow((s) => s.activePosition?.market === slug),
  );

  const currentPrice = priceData?.last ?? 0;
  const change24h = priceData?.change24h ?? 0;
  const totalOi = info ? info.longOi + info.shortOi : 0;

  // Pre-computed annualized borrow rate for display (from parseGmxAnnualRate)
  const borrowRateAnnualized = useMemo(() => {
    if (!info) return "—";
    const annual = Math.max(
      info.borrowRateLongAnnualized,
      info.borrowRateShortAnnualized,
    );
    if (annual <= 0) return "—";
    if (annual > 1000) return ">1000%";
    return `${annual.toFixed(0)}%`;
  }, [info]);

  const isPositive = change24h >= 0;

  return (
    <motion.button
      whileHover={{ scale: 1.01, borderColor: "var(--color-blue-primary)" }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onClick(slug)}
      className="w-full rounded-xl border border-border-primary bg-bg-card p-4 text-left transition-colors hover:border-blue-primary"
      aria-label={`${market.name} — ${currentPrice > 0 ? formatPrice(currentPrice, market.decimals) : "Loading..."}`}
    >
      {/* Top row: Icon + Name + Position badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">
            {market.icon}
          </span>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {market.pair}
            </h3>
            <p className="text-xs text-text-muted">{market.name} Perpetual</p>
          </div>
        </div>
        {hasPosition && (
          <span className="rounded-full bg-green-bg px-2 py-0.5 text-xs font-medium text-green-primary">
            Active
          </span>
        )}
      </div>

      {/* Price row */}
      <div className="mt-3">
        {currentPrice > 0 ? (
          <p className="text-xl font-bold text-text-primary">
            ${formatPrice(currentPrice, market.decimals)}
          </p>
        ) : (
          <div className="h-7 w-24 animate-pulse rounded bg-bg-input" />
        )}
      </div>

      {/* Stats row */}
      <div className="mt-2 flex items-center gap-4">
        {/* 24h Change */}
        {change24h !== 0 ? (
          <span
            className={`text-xs font-medium ${
              isPositive ? "text-green-primary" : "text-red-primary"
            }`}
          >
            {formatPercent(change24h)}
          </span>
        ) : (
          <span className="text-xs text-text-muted">—</span>
        )}

        {/* Open Interest */}
        {totalOi > 0 ? (
          <span className="text-xs text-text-muted">
            OI: {formatUSDCompact(totalOi)}
          </span>
        ) : null}

        {/* Borrow Rate */}
        <span className="text-xs text-text-muted">
          Borrow: {borrowRateAnnualized}
        </span>
      </div>
    </motion.button>
  );
}

export const MarketCard = memo(MarketCardInner);
export default MarketCard;
