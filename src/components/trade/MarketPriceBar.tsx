"use client";

import { memo, useMemo } from "react";
import type { ApiConnectionStatus, MarketSlug, PriceData, MarketInfo } from "@/types";
import { formatPrice, formatUSDCompact, formatPercent } from "@/lib/format";
import { MARKETS } from "@/lib/constants";
import { motion } from "framer-motion";
import { MetricItem } from "@/components/trade/ui";

// ─── Types ────────────────────────────────────────────────

export interface MarketPriceBarProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  connectionStatus?: ApiConnectionStatus;
}

const CONNECTION_LABEL: Record<ApiConnectionStatus, string> = {
  connected: "Live",
  degraded: "Slow",
  fallback: "Fallback",
  disconnected: "Off",
};

const CONNECTION_DOT: Record<ApiConnectionStatus, string> = {
  connected: "bg-green-primary",
  degraded: "bg-yellow-primary",
  fallback: "bg-yellow-primary",
  disconnected: "bg-red-primary",
};

// ─── Component ────────────────────────────────────────────

function MarketPriceBarInner({
  market,
  priceData,
  marketInfo,
  connectionStatus = "disconnected",
}: MarketPriceBarProps) {
  const marketConfig = MARKETS[market];
  const currentPrice = priceData?.last ?? 0;
  const change24h = priceData?.change24h ?? 0;
  const isPositive = change24h >= 0;

  const totalOi = useMemo(() => {
    if (!marketInfo) return 0;
    return marketInfo.longOi + marketInfo.shortOi;
  }, [marketInfo]);

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

  const fundingDisplay = useMemo(() => {
    if (!marketInfo) return "—";
    const long = marketInfo.fundingRateLongAnnualized;
    const short = marketInfo.fundingRateShortAnnualized;
    const maxAbs = Math.max(Math.abs(long), Math.abs(short));
    if (!Number.isFinite(maxAbs) || maxAbs <= 0) return "—";
    const signed = Math.abs(long) >= Math.abs(short) ? long : short;
    return formatPercent(signed);
  }, [marketInfo]);

  const netRateDisplay = useMemo(() => {
    if (!marketInfo) return "—";
    const longNet = marketInfo.netRateLongAnnualized;
    const shortNet = marketInfo.netRateShortAnnualized;
    const dominant = Math.abs(longNet) >= Math.abs(shortNet) ? longNet : shortNet;
    if (!Number.isFinite(dominant) || Math.abs(dominant) < 0.005) return "0.00%";
    return formatPercent(dominant);
  }, [marketInfo]);

  return (
    <div className="min-w-0 space-y-2">
      <div className="scrollbar-none flex min-w-0 items-center gap-0 overflow-x-auto rounded-lg border border-trade-border-subtle bg-trade-strip px-3 py-2 md:px-4">
        {/* Price cluster */}
        <div className="flex shrink-0 items-center gap-2 pr-3">
          <span className="text-xl" aria-hidden="true">
            {marketConfig.icon}
          </span>
          <div className="min-w-0">
            {currentPrice > 0 ? (
              <motion.p
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="text-base font-bold tabular-nums text-text-primary md:text-lg"
              >
                ${formatPrice(currentPrice, marketConfig.decimals)}
              </motion.p>
            ) : (
              <div className="h-6 w-24 animate-pulse rounded bg-trade-raised" />
            )}
            <p className="text-[length:var(--text-trade-label)] text-text-muted">
              {marketConfig.pair} Perp
            </p>
          </div>
        </div>

        <div
          className="hidden h-7 w-px shrink-0 bg-trade-border-subtle sm:block"
          aria-hidden="true"
        />

        <div className="flex min-w-0 flex-1 items-center gap-x-4 gap-y-1 pl-3 sm:pl-4">
          <MetricItem
            label="24h"
            value={
              change24h !== 0 ? (
                <span
                  className={
                    isPositive ? "text-green-primary" : "text-red-primary"
                  }
                >
                  {formatPercent(change24h)}
                </span>
              ) : (
                "—"
              )
            }
          />
          <MetricItem
            label="Volume"
            value={
              priceData?.volume24hUsd && priceData.volume24hUsd > 0
                ? formatUSDCompact(priceData.volume24hUsd)
                : marketInfo?.totalLiquidityUsd && marketInfo.totalLiquidityUsd > 0
                  ? `~${formatUSDCompact(marketInfo.totalLiquidityUsd)}`
                : "—"
            }
            className="hidden md:flex"
          />
          <MetricItem
            label="Open interest"
            value={totalOi > 0 ? formatUSDCompact(totalOi) : "—"}
          />
          <MetricItem label="Borrow" value={borrowRateAnnualized} className="hidden lg:flex" />
          <MetricItem label="Funding" value={fundingDisplay} className="hidden lg:flex" />
          <MetricItem label="Net rate" value={netRateDisplay} className="hidden xl:flex" />

          <div
            className="ml-auto flex shrink-0 items-center gap-1.5 border-l border-trade-border-subtle pl-3"
            title={connectionStatus}
            aria-label={`Price feed: ${connectionStatus}`}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${CONNECTION_DOT[connectionStatus]}`}
              />
            </span>
            <span className="hidden text-[length:var(--text-trade-stat)] text-text-muted sm:inline">
              {CONNECTION_LABEL[connectionStatus]}
            </span>
          </div>
        </div>
      </div>

      {connectionStatus === "fallback" && (
        <div className="rounded-md border border-yellow-primary/25 bg-yellow-primary/10 px-3 py-1.5 text-[length:var(--text-trade-stat)] text-yellow-primary">
          Binance fallback — prices may differ from the GMX oracle.
        </div>
      )}
    </div>
  );
}

export const MarketPriceBar = memo(MarketPriceBarInner);
export default MarketPriceBar;
