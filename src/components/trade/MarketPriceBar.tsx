"use client";

import { memo, useMemo } from "react";
import type { ApiConnectionStatus, MarketSlug, PriceData, MarketInfo } from "@/types";
import { formatPrice, formatUSDCompact, formatPercent } from "@/lib/format";
import { MARKETS } from "@/lib/constants";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────

export interface MarketPriceBarProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  connectionStatus?: ApiConnectionStatus;
}

// ─── Component ────────────────────────────────────────────

function MarketPriceBarInner({
  market,
  priceData,
  marketInfo,
  connectionStatus,
}: MarketPriceBarProps) {
  const marketConfig = MARKETS[market];
  const currentPrice = priceData?.last ?? 0;
  const change24h = priceData?.change24h ?? 0;
  const isPositive = change24h >= 0;

  // Total OI
  const totalOi = useMemo(() => {
    if (!marketInfo) return 0;
    return marketInfo.longOi + marketInfo.shortOi;
  }, [marketInfo]);

  // Borrow rate for display
  const borrowRateAnnualized = useMemo(() => {
    if (!marketInfo) return "—";
    const annual = Math.max(
      marketInfo.borrowRateLongAnnualized,
      marketInfo.borrowRateShortAnnualized,
    );
    if (annual <= 0) return "—";
    if (annual > 1000) return ">1000%";
    return `${annual.toFixed(0)}%`;
  }, [marketInfo]);

  return (
    <div className="space-y-2">
    <div className="flex items-center gap-4 overflow-x-auto rounded-xl border border-border-primary bg-bg-card px-4 py-2.5 scrollbar-none">
      {/* Price */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-2xl" aria-hidden="true">
          {marketConfig.icon}
        </span>
        <div>
          {currentPrice > 0 ? (
            <motion.p
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-lg font-bold text-text-primary tabular-nums"
            >
              ${formatPrice(currentPrice, marketConfig.decimals)}
            </motion.p>
          ) : (
            <div className="h-6 w-24 animate-pulse rounded bg-bg-input" />
          )}
          <p className="text-[10px] text-text-muted">
            {marketConfig.pair} Perpetual
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="h-8 w-px bg-border-primary" aria-hidden="true" />

      {/* 24h Change */}
      <div className="flex-shrink-0">
        <p className="text-[10px] text-text-muted">24h</p>
        <p
          className={`text-xs font-medium tabular-nums ${
            change24h === 0
              ? "text-text-muted"
              : isPositive
                ? "text-green-primary"
                : "text-red-primary"
          }`}
        >
          {change24h !== 0 ? formatPercent(change24h) : "—"}
        </p>
      </div>

      {/* Open Interest */}
      <div className="flex-shrink-0">
        <p className="text-[10px] text-text-muted">OI</p>
        <p className="text-xs font-medium text-text-secondary tabular-nums">
          {totalOi > 0 ? formatUSDCompact(totalOi) : "—"}
        </p>
      </div>

      {/* Borrow Rate */}
      <div className="flex-shrink-0">
        <p className="text-[10px] text-text-muted">Borrow</p>
        <p className="text-xs font-medium text-text-secondary tabular-nums">
          {borrowRateAnnualized}
        </p>
      </div>
    </div>
      {connectionStatus === "fallback" && (
        <div className="rounded-lg border border-yellow-primary/30 bg-yellow-primary/10 px-3 py-2 text-[11px] text-yellow-primary">
          Using fallback Binance prices. They may differ from GMX oracle prices
          and use a simulated min/max spread.
        </div>
      )}
    </div>
  );
}

export const MarketPriceBar = memo(MarketPriceBarInner);
export default MarketPriceBar;
