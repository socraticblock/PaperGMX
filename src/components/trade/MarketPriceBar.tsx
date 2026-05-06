"use client";

import { memo, useMemo } from "react";
import { useRouter } from "next/navigation";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type { ApiConnectionStatus, MarketSlug, PriceData, MarketInfo } from "@/types";
import { formatPrice, formatUSDCompact, formatPercent } from "@/lib/format";
import { MARKETS, MARKET_SLUGS } from "@/lib/constants";
import { motion } from "framer-motion";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

export interface MarketPriceBarProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  connectionStatus?: ApiConnectionStatus;
}

const CONNECTION_LABEL: Record<ApiConnectionStatus, string> = {
  connected: "GMX oracle",
  degraded: "Stale",
  disconnected: "No feed",
};

const CONNECTION_DOT: Record<ApiConnectionStatus, string> = {
  connected: "bg-green-primary",
  degraded: "bg-yellow-primary",
  disconnected: "bg-red-primary",
};

function MarketPriceBarInner({
  market,
  priceData,
  marketInfo,
  connectionStatus = "disconnected",
}: MarketPriceBarProps) {
  const router = useRouter();
  const balance = usePaperStore(useShallow((s) => s.balance));
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
    return "—";
  }, [priceData]);

  const netRates = useMemo(() => {
    if (!marketInfo) return null;

    // Calculate 1h net rate directly from funding and borrowing components (GMX-style).
    // Formula: (FundingRate - BorrowRate) * 3600 * 100
    // Note: We maintain sign fidelity so that Profit = Positive, Cost = Negative.
    const longHourly = (-marketInfo.fundingRateLong - marketInfo.borrowRateLong) * 3600 * 100;
    const shortHourly = (-marketInfo.fundingRateShort - marketInfo.borrowRateShort) * 3600 * 100;

    const buildTooltip = (
      side: "Long" | "Short",
      net1h: number,
      fundingPerSec: number,
      borrowPerSec: number
    ) => {
      const funding1h = -fundingPerSec * 3600 * 100;
      const borrow1h = -borrowPerSec * 3600 * 100;
      
      const fundingAction = funding1h >= 0 ? "receive" : "pay";
      const borrowAction = borrow1h < 0 ? "pay" : "do not pay";

      return `${side} positions Net rate:
8h: ${formatPercent(net1h * 8, 4)}
24h: ${formatPercent(net1h * 24, 4)}
365d: ${formatPercent(net1h * 24 * 365, 2)}

${side} positions ${fundingAction} funding fee of ${formatPercent(Math.abs(funding1h), 4)} per hour
and ${borrowAction} borrow fee of ${formatPercent(Math.abs(borrow1h), 4)} per hour`;
    };

    const longTooltip = buildTooltip("Long", longHourly, marketInfo.fundingRateLong, marketInfo.borrowRateLong);
    const shortTooltip = buildTooltip("Short", shortHourly, marketInfo.fundingRateShort, marketInfo.borrowRateShort);

    return {
      long: formatPercent(longHourly, 4),
      short: formatPercent(shortHourly, 4),
      tooltip: `${longTooltip}\n\n${shortTooltip}`,
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
        <div className="scrollbar-none overflow-x-auto px-3 py-2 md:px-4 lg:px-5">
          <div className="flex min-w-[720px] flex-col gap-3 lg:min-w-0 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
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
            <div className="flex min-w-0 flex-1 flex-wrap items-start gap-x-8 gap-y-3 lg:justify-end">
              <div className="min-w-[100px]">
                <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                  Session
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
                <div className="flex items-center gap-1">
                  <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                    Net rate / 1h
                  </p>
                  {netRates && (
                    <span title={netRates.tooltip} className="cursor-help">
                      <InformationCircleIcon
                        className="h-3 w-3 text-text-muted/60"
                        aria-hidden="true"
                      />
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[length:var(--text-trade-stat)] font-medium">
                  <span className="text-green-primary tabular-nums">
                    Long {netRates?.long ?? "—"}
                  </span>
                  <span className="text-red-primary tabular-nums">
                    Short {netRates?.short ?? "—"}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 border-t border-trade-border-subtle pt-3 lg:border-t-0 lg:pt-0">
                <div className="rounded-md border border-trade-border-subtle bg-trade-panel px-3 py-1.5">
                  <p className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                    Paper balance
                  </p>
                  <p className="text-[length:var(--text-trade-stat)] font-semibold tabular-nums text-text-primary">
                    ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC
                  </p>
                  <p
                    className="text-[length:var(--text-trade-label)] text-text-muted"
                    title="No wallet required. PaperGMX uses fake funds for GMX training."
                  >
                    Simulated funds
                  </p>
                </div>
                <div className="flex items-center gap-2">
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
      </div>

      {connectionStatus === "disconnected" && (
        <div className="rounded-md border border-red-primary/25 bg-red-primary/10 px-3 py-1.5 text-[length:var(--text-trade-stat)] text-red-primary">
          GMX Arbitrum API unreachable — oracle prices and pool stats load only
          from GMX infra (no substitute exchange feed).
        </div>
      )}
      {connectionStatus === "degraded" && (
        <div className="rounded-md border border-yellow-primary/25 bg-yellow-primary/10 px-3 py-1.5 text-[length:var(--text-trade-stat)] text-yellow-primary">
          Oracle data may be stale. PaperGMX does not switch to non-GMX prices.
        </div>
      )}
      {connectionStatus === "connected" && currentPrice > 0 && !marketInfo && (
        <div className="rounded-md border border-yellow-primary/25 bg-yellow-primary/10 px-3 py-1.5 text-[length:var(--text-trade-stat)] text-yellow-primary">
          Waiting for GMX pool metadata (open interest, borrow &amp; funding
          rates). Execution uses oracle prices; accrued borrow/funding update
          once this loads.
        </div>
      )}
    </div>
  );
}

export const MarketPriceBar = memo(MarketPriceBarInner);
export default MarketPriceBar;
