"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { ApiConnectionStatus, MarketSlug, PriceData, MarketInfo } from "@/types";
import { formatPrice, formatUSDCompact, formatPercent } from "@/lib/format";
import { MARKETS, MARKET_SLUGS } from "@/lib/constants";
import { motion } from "framer-motion";

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

/** Rough APR → average hourly % for display (GMX-style small 1H numbers). */
function approxHourlyAprPercent(annualPercent: number): number {
  if (!Number.isFinite(annualPercent)) return 0;
  return annualPercent / (365 * 24);
}

function MarketPriceBarInner({
  market,
  priceData,
  marketInfo,
  connectionStatus = "disconnected",
}: MarketPriceBarProps) {
  const router = useRouter();
  const marketConfig = MARKETS[market];
  const currentPrice = priceData?.last ?? 0;
  const change24h = priceData?.change24h ?? 0;
  const isPositive = change24h >= 0;

  const longOi = marketInfo?.longOi ?? 0;
  const shortOi = marketInfo?.shortOi ?? 0;
  const totalOi = longOi + shortOi;

  const oiSplit = useMemo(() => {
    if (totalOi <= 0)
      return { pctLong: 0, pctShort: 0, longUsd: 0, shortUsd: 0 };
    const pctLong = (longOi / totalOi) * 100;
    const pctShort = (shortOi / totalOi) * 100;
    return { pctLong, pctShort, longUsd: longOi, shortUsd: shortOi };
  }, [longOi, shortOi, totalOi]);

  const volumeDisplay = useMemo(() => {
    if (priceData?.volume24hUsd && priceData.volume24hUsd > 0) {
      return formatUSDCompact(priceData.volume24hUsd);
    }
    if (marketInfo?.totalLiquidityUsd && marketInfo.totalLiquidityUsd > 0) {
      return `~${formatUSDCompact(marketInfo.totalLiquidityUsd)}`;
    }
    return "—";
  }, [priceData, marketInfo]);

  const netHourly = useMemo(() => {
    if (!marketInfo) return { long: "—", short: "—" };
    const l = approxHourlyAprPercent(marketInfo.netRateLongAnnualized);
    const s = approxHourlyAprPercent(marketInfo.netRateShortAnnualized);
    return {
      long: formatPercent(l, 4),
      short: formatPercent(s, 4),
    };
  }, [marketInfo]);

  const availLiq = useMemo(() => {
    if (!marketInfo) return { long: "—", short: "—" };
    const l = marketInfo.availableLiquidityLong;
    const s = marketInfo.availableLiquidityShort;
    return {
      long: l > 0 ? formatUSDCompact(l) : "—",
      short: s > 0 ? formatUSDCompact(s) : "—",
    };
  }, [marketInfo]);

  const poolLabel = `${marketConfig.symbol}-USDC`;

  return (
    <div className="min-w-0 space-y-2">
      <div className="rounded-lg border border-trade-border-subtle bg-trade-strip">
        {/* Desktop-first: two-row strip similar to app.gmx.io */}
        <div className="scrollbar-none overflow-x-auto px-3 py-3 md:px-4 lg:px-5">
          <div className="flex min-w-[720px] flex-col gap-4 lg:min-w-0 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
            {/* Pair + price + selector */}
            <div className="flex shrink-0 items-start gap-3">
              <span className="text-2xl leading-none" aria-hidden="true">
                {marketConfig.icon}
              </span>
              <div className="min-w-0">
                <p className="text-[length:var(--text-trade-label)] text-text-muted">
                  <span className="font-medium text-text-secondary">
                    {marketConfig.pair}
                  </span>
                  <span className="text-text-muted"> [{poolLabel}]</span>
                </p>
                {currentPrice > 0 ? (
                  <motion.p
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="mt-0.5 text-xl font-semibold tabular-nums text-text-primary md:text-2xl"
                  >
                    ${formatPrice(currentPrice, marketConfig.decimals)}
                  </motion.p>
                ) : (
                  <div className="mt-1 h-8 w-36 animate-pulse rounded bg-trade-raised" />
                )}
                <label className="sr-only" htmlFor="trade-market-select">
                  Market
                </label>
                <select
                  id="trade-market-select"
                  value={market}
                  onChange={(e) =>
                    router.push(`/trade/${e.target.value as MarketSlug}`)
                  }
                  className="mt-2 max-w-[14rem] cursor-pointer rounded border border-trade-border-subtle bg-trade-raised py-1 pl-2 pr-8 text-[length:var(--text-trade-body)] font-medium text-text-primary focus:border-trade-border-active focus:outline-none focus:ring-1 focus:ring-trade-border-active"
                >
                  {MARKET_SLUGS.map((slug) => (
                    <option key={slug} value={slug}>
                      {MARKETS[slug].pair}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Stats clusters */}
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-8 gap-y-4 lg:justify-end">
              <div className="min-w-[100px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  24h
                </p>
                <p
                  className={`mt-0.5 text-[length:var(--text-trade-stat)] font-medium tabular-nums ${
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

              <div className="min-w-[100px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  24h volume
                </p>
                <p className="mt-0.5 text-[length:var(--text-trade-stat)] font-medium tabular-nums text-text-secondary">
                  {volumeDisplay}
                </p>
              </div>

              <div className="min-w-[200px] max-w-[340px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  Open interest
                </p>
                {totalOi > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-trade-stat)] font-medium">
                    <span className="tabular-nums text-green-primary">
                      Long {oiSplit.pctLong.toFixed(0)}% ·{" "}
                      {formatUSDCompact(oiSplit.longUsd)}
                    </span>
                    <span className="tabular-nums text-red-primary">
                      Short {oiSplit.pctShort.toFixed(0)}% ·{" "}
                      {formatUSDCompact(oiSplit.shortUsd)}
                    </span>
                  </div>
                ) : (
                  <p className="mt-0.5 text-[length:var(--text-trade-stat)] text-text-muted">
                    —
                  </p>
                )}
              </div>

              <div className="min-w-[200px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  Available liquidity
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-trade-stat)] font-medium tabular-nums text-text-secondary">
                  <span>Long {availLiq.long}</span>
                  <span>Short {availLiq.short}</span>
                </div>
              </div>

              <div className="min-w-[180px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  Net rate / 1h
                </p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-trade-stat)] font-medium">
                  <span className="text-green-primary tabular-nums">
                    Long {netHourly.long}
                  </span>
                  <span className="text-red-primary tabular-nums">
                    Short {netHourly.short}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2 border-t border-trade-border-subtle pt-3 lg:border-t-0 lg:pt-0">
                <span className="relative flex h-2 w-2">
                  <span
                    className={`inline-flex h-2 w-2 rounded-full ${CONNECTION_DOT[connectionStatus]}`}
                  />
                </span>
                <span className="text-[length:var(--text-trade-stat)] text-text-muted">
                  {CONNECTION_LABEL[connectionStatus]}
                </span>
              </div>
            </div>
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
