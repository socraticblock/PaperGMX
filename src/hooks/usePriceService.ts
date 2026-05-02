"use client";

import { useEffect, useRef } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { startPriceService } from "@/lib/api/priceService";
import type { MarketSlug } from "@/types";
import type {
  ParsedMarketPrice,
  ParsedMarketInfo,
  ApiConnectionStatus,
} from "@/lib/api/types";
import { price, usd, bps, percent } from "@/lib/branded";
import { calculatePriceChangePercent } from "@/lib/api/gmxPrice";
import { MARKET_SLUGS } from "@/lib/constants";

/**
 * Hook that manages the price service lifecycle.
 * Starts polling when mounted, stops when unmounted.
 * Updates the Zustand store with price data.
 *
 * Tracks 24h price change by storing the first price seen on each
 * session and computing the percentage change from that baseline.
 *
 * Only ONE instance of this hook should be active at a time.
 * The priceService.ts singleton guard ensures this.
 */
export function usePriceService(): void {
  const cleanupRef = useRef<(() => void) | null>(null);

  // Store first-seen prices for 24h change calculation
  // In a production app, this would use actual 24h-old prices from an API.
  // Since GMX doesn't provide 24h change, we track from session start.
  const sessionStartPrices = useRef<Partial<Record<MarketSlug, number>>>({});

  const setPrices = usePaperStore((s) => s.setPrices);
  const setMarketInfo = usePaperStore((s) => s.setMarketInfo);
  const setConnectionStatus = usePaperStore((s) => s.setConnectionStatus);

  useEffect(() => {
    cleanupRef.current = startPriceService({
      onPriceUpdate: (rawPrices: Record<MarketSlug, ParsedMarketPrice>, isPartial?: boolean) => {
        // Convert ParsedMarketPrice to our branded PriceData format
        const brandedPrices = {} as Record<
          MarketSlug,
          import("@/types").PriceData
        >;

        for (const [slug, data] of Object.entries(rawPrices)) {
          if (!data) continue; // Skip undefined entries from partial updates
          const midPrice = data.midPrice;

          // Guard against zero/negative prices that would cause price() to
          // throw. This can happen if the GMX API or Binance fallback returns
          // stale or malformed data for a particular market.
          if (midPrice <= 0 || data.minPrice <= 0 || data.maxPrice <= 0) continue;

          // Record first-seen price as baseline for change calculation
          if (!(slug in sessionStartPrices.current) && midPrice > 0) {
            sessionStartPrices.current[slug as MarketSlug] = midPrice;
          }

          // Calculate change from session start
          let change24h = percent(0);
          const startPrice = sessionStartPrices.current[slug as MarketSlug];
          if (startPrice && startPrice > 0 && midPrice > 0) {
            change24h = calculatePriceChangePercent(
              price(midPrice),
              price(startPrice),
            );
          }

          brandedPrices[slug as MarketSlug] = {
            min: price(data.minPrice),
            max: price(data.maxPrice),
            last: price(midPrice),
            change24h,
            volume24hUsd:
              data.volume24hUsd && data.volume24hUsd > 0
                ? usd(data.volume24hUsd)
                : undefined,
          };
        }

        const hasAllMarkets = MARKET_SLUGS.every((slug) => brandedPrices[slug]);

        // Partial updates should merge with existing prices so unavailable
        // markets keep their last known good GMX value instead of disappearing.
        if (isPartial || !hasAllMarkets) {
          const existing = usePaperStore.getState().prices;
          setPrices({ ...existing, ...brandedPrices });
        } else {
          setPrices(brandedPrices);
        }
      },
      onMarketInfoUpdate: (rawInfo: Record<MarketSlug, ParsedMarketInfo>) => {
        // Convert to our branded MarketInfo format
        const brandedInfo = {} as Record<
          MarketSlug,
          import("@/types").MarketInfo
        >;

        for (const [slug, data] of Object.entries(rawInfo)) {
          brandedInfo[slug as MarketSlug] = {
            slug: slug as MarketSlug,
            longOi: usd(data.longOiUsd),
            shortOi: usd(data.shortOiUsd),
            availableLiquidityLong: usd(data.availableLiquidityLongUsd),
            availableLiquidityShort: usd(data.availableLiquidityShortUsd),
            totalLiquidityUsd: usd(data.totalLiquidityUsd),
            borrowRateLong: data.borrowRateLongPerSecond,
            borrowRateShort: data.borrowRateShortPerSecond,
            borrowRateLongAnnualized: data.borrowRateLongAnnualized,
            borrowRateShortAnnualized: data.borrowRateShortAnnualized,
            fundingRateLong: data.fundingRateLongPerSecond,
            fundingRateShort: data.fundingRateShortPerSecond,
            fundingRateLongAnnualized: data.fundingRateLongAnnualized,
            fundingRateShortAnnualized: data.fundingRateShortAnnualized,
            netRateLongAnnualized: data.netRateLongAnnualized,
            netRateShortAnnualized: data.netRateShortAnnualized,
            positionFeeBps: bps(data.positionFeeBps),
            maxPnlFactorForTraders: data.maxPnlFactorForTraders,
          };
        }

        // Always merge with existing info — GMX API may return partial data
        // for some markets, and Binance fallback never provides market info.
        const existing = usePaperStore.getState().marketInfo;
        setMarketInfo({ ...existing, ...brandedInfo });
      },
      onStatusChange: (status: ApiConnectionStatus) => {
        setConnectionStatus(status);
      },
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [setPrices, setMarketInfo, setConnectionStatus]);
}
