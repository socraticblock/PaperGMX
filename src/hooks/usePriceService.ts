"use client";

import { useEffect, useRef } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { startPriceService } from "@/lib/api/priceService";
import type { MarketSlug } from "@/types";
import type { ParsedMarketPrice, ParsedMarketInfo, ApiConnectionStatus } from "@/lib/api/types";
import { price, usd, bps, percent } from "@/lib/branded";

/**
 * Hook that manages the price service lifecycle.
 * Starts polling when mounted, stops when unmounted.
 * Updates the Zustand store with price data.
 * 
 * Only ONE instance of this hook should be active at a time.
 * Use in the root layout or the market selection page.
 */
export function usePriceService(): void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const isRunningRef = useRef(false);

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
          brandedPrices[slug as MarketSlug] = {
            min: price(data.minPrice),
            max: price(data.maxPrice),
            last: price(data.midPrice),
            change24h: percent(0), // Calculated from price history tracking
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
            fundingRate: data.fundingRatePerSecond,
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
