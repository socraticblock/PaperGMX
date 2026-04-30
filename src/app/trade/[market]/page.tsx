"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import { MARKETS, MARKET_SLUGS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { usePriceService } from "@/hooks/usePriceService";
import type { MarketSlug } from "@/types";

export default function TradePage() {
  const router = useRouter();
  const params = useParams();
  const marketSlug = params.market as string;

  const isInitialized = usePaperStore(useShallow((s) => s.isInitialized));
  const priceData = usePaperStore(
    useShallow((s) => s.prices[marketSlug as MarketSlug])
  );

  // Start price service
  usePriceService();

  // Validate market slug
  const isValidMarket = (MARKET_SLUGS as readonly string[]).includes(marketSlug);
  const market = isValidMarket ? MARKETS[marketSlug as MarketSlug] : null;

  useEffect(() => {
    if (!isInitialized) {
      router.push("/");
    } else if (!isValidMarket) {
      router.push("/markets");
    }
  }, [isInitialized, isValidMarket, router]);

  if (!isInitialized || !isValidMarket || !market) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Redirecting...</p>
      </div>
    );
  }

  const currentPrice = priceData?.last ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SettingsPanel />

      <main className="flex-1 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-lg">
          {/* Back button + Market header */}
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.push("/markets")}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-primary text-text-secondary hover:text-text-primary"
              aria-label="Back to markets"
            >
              ←
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xl" aria-hidden="true">{market.icon}</span>
              <h1 className="text-lg font-bold text-text-primary">{market.pair}</h1>
            </div>
            {currentPrice > 0 && (
              <span className="ml-auto text-lg font-bold text-text-primary">
                ${formatPrice(currentPrice, market.decimals)}
              </span>
            )}
          </div>

          {/* Placeholder for Phase 3: Trade Setup */}
          <div className="rounded-xl border border-border-primary bg-bg-card p-8 text-center">
            <p className="text-lg font-semibold text-text-primary">
              Trade Setup
            </p>
            <p className="mt-2 text-sm text-text-muted">
              Coming in Phase 3 — direction toggle, amount input, leverage selector, fee summary.
            </p>
            <p className="mt-4 text-xs text-text-muted">
              Current Price: {currentPrice > 0 ? `$${formatPrice(currentPrice, market.decimals)}` : "Loading..."}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
