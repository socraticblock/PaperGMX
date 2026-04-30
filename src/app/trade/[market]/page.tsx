"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import { usePriceService } from "@/hooks/usePriceService";
import { MARKETS, MARKET_SLUGS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import MarketPriceBar from "@/components/trade/MarketPriceBar";
import OrderEntryForm from "@/components/trade/OrderEntryForm";
import type { MarketSlug } from "@/types";

export default function TradePage() {
  const router = useRouter();
  const params = useParams();
  const market = params.market as string;
  const isInitialized = usePaperStore(useShallow((s) => s.isInitialized));
  const activePosition = usePaperStore(useShallow((s) => s.activePosition));
  const prices = usePaperStore(useShallow((s) => s.prices));
  const marketInfo = usePaperStore(useShallow((s) => s.marketInfo));

  // Start price service
  usePriceService();

  // Redirect to landing if not initialized
  useEffect(() => {
    if (!isInitialized) {
      router.push("/");
    }
  }, [isInitialized, router]);

  // Redirect to markets if invalid market slug
  const isValidMarket = MARKET_SLUGS.includes(market as MarketSlug);

  useEffect(() => {
    if (isInitialized && !isValidMarket) {
      router.push("/markets");
    }
  }, [isInitialized, isValidMarket, router]);

  // Redirect to position page if position is active (Phase 4+)
  useEffect(() => {
    if (activePosition && activePosition.status === "active") {
      // For now, stay on this page. Phase 4 will add position view.
    }
  }, [activePosition]);

  if (!isInitialized || !isValidMarket) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Redirecting...</p>
      </div>
    );
  }

  const marketConfig = MARKETS[market as MarketSlug];
  const slug = market as MarketSlug;
  const priceData = prices[slug];
  const info = marketInfo[slug];
  const currentPrice = priceData?.last ?? 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SettingsPanel />

      <main className="flex-1 px-4 py-4 md:px-6">
        <div className="mx-auto max-w-6xl">
          {/* Top bar: Back + Market Price Bar */}
          <div className="mb-4 flex items-center gap-3">
            <button
              onClick={() => router.push("/markets")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary flex-shrink-0"
              aria-label="Back to markets"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-text-secondary">
                <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <MarketPriceBar
                market={slug}
                priceData={priceData}
                marketInfo={info}
              />
            </div>
          </div>

          {/* Two-column layout on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
            {/* Left: Chart area placeholder (Phase 6+) */}
            <div className="hidden lg:block">
              <div className="sticky top-20 rounded-xl border border-border-primary bg-bg-card p-8 text-center min-h-[500px] flex flex-col items-center justify-center">
                <div className="mb-4">
                  <span className="text-5xl" aria-hidden="true">{marketConfig.icon}</span>
                </div>
                <h2 className="text-xl font-bold text-text-primary">{marketConfig.pair}</h2>
                {currentPrice > 0 && (
                  <p className="mt-2 text-3xl font-bold text-text-primary tabular-nums">
                    ${formatPrice(currentPrice, marketConfig.decimals)}
                  </p>
                )}
                <p className="mt-3 text-sm text-text-muted">
                  Live chart coming in Phase 6
                </p>

                {/* Price update indicator */}
                {priceData && (
                  <div className="mt-6 flex items-center gap-4 text-xs text-text-muted">
                    <div>
                      <span className="text-text-secondary">Oracle Min:</span>{" "}
                      <span className="text-text-primary tabular-nums">${formatPrice(priceData.min, marketConfig.decimals)}</span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Oracle Max:</span>{" "}
                      <span className="text-text-primary tabular-nums">${formatPrice(priceData.max, marketConfig.decimals)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Order Entry Form */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-xl border border-border-primary bg-bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  Place Order
                </h2>
                <OrderEntryForm market={slug} />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border-primary px-4 py-4 text-center">
        <a
          href="https://app.gmx.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-muted transition-colors hover:text-blue-primary"
        >
          Ready for real trading? Switch to GMX →
        </a>
      </footer>
    </div>
  );
}
