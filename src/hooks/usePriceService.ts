"use client";

import { useEffect, useRef } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { startPriceService } from "@/lib/api/priceService";
import type { MarketSlug } from "@/types";
import type { ParsedMarketPrice, ParsedMarketInfo, ApiConnectionStatus } from "@/lib/api/types";
import { price, usd, bps, percent } from "@/lib/branded";
import { calculatePriceChangePercent } from "@/lib/api/gmxPrice";

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
  const isRunningRef = useRef(false);

  // Store first-seen prices for 24h change calculation
  // In a production app, this would use actual 24h-old prices from an API.
  // Since GMX doesn't provide 24h change, we track from session start.
  const sessionStartPrices = useRef<Partial<Record<MarketSlug, number>>>({});

  const setPrices = usePaperStore((s) => s.setPrices);
  const setMarketInfo = usePaperStore((s) => s.setMarketInfo);
  const setConnectionStatus = usePaperStore((s) => s.setConnectionStatus);

  useEffect(() => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;

    cleanupRef.current = startPriceService({
      onPriceUpdate: (rawPrices: Record<MarketSlug, ParsedMarketPrice>) => {
        // Convert ParsedMarketPrice to our branded PriceData format
        const brandedPrices = {} as Record<MarketSlug, import("@/types").PriceData>;

        for (const [slug, data] of Object.entries(rawPrices)) {
          const midPrice = data.midPrice;

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
              price(startPrice)
            );
          }

          brandedPrices[slug as MarketSlug] = {
            min: price(data.minPrice),
            max: price(data.maxPrice),
            last: price(midPrice),
            change24h,
          };
        }

        setPrices(brandedPrices);
      },
      onMarketInfoUpdate: (rawInfo: Record<MarketSlug, ParsedMarketInfo>) => {
        // Convert to our branded MarketInfo format
        const brandedInfo = {} as Record<MarketSlug, import("@/types").MarketInfo>;

        for (const [slug, data] of Object.entries(rawInfo)) {
          brandedInfo[slug as MarketSlug] = {
            slug: slug as MarketSlug,
            longOi: usd(data.longOiUsd),
            shortOi: usd(data.shortOiUsd),
            borrowRateLong: data.borrowRateLongPerSecond,
            borrowRateShort: data.borrowRateShortPerSecond,
            borrowRateLongAnnualized: data.borrowRateLongAnnualized,
            borrowRateShortAnnualized: data.borrowRateShortAnnualized,
            fundingRate: data.fundingRatePerSecond,
            fundingRateAnnualized: data.fundingRateAnnualized,
            positionFeeBps: bps(data.positionFeeBps),
          };
        }

        setMarketInfo(brandedInfo);
      },
      onStatusChange: (status: ApiConnectionStatus) => {
        setConnectionStatus(status);
      },
    });

    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      isRunningRef.current = false;
    };
  }, [setPrices, setMarketInfo, setConnectionStatus]);
}
