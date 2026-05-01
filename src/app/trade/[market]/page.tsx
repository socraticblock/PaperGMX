"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import { usePriceService } from "@/hooks/usePriceService";
import { MARKET_SLUGS } from "@/lib/constants";
import MarketPriceBar from "@/components/trade/MarketPriceBar";
import OrderEntryForm from "@/components/trade/OrderEntryForm";
import PriceChart from "@/components/trade/PriceChart";
import type { MarketSlug } from "@/types";

export default function TradePage() {
  const router = useRouter();
  const marketParam = useParams().market;
  const market = Array.isArray(marketParam) ? marketParam[0] : marketParam;
  const isInitialized = usePaperStore(useShallow((s) => s.isInitialized));
  const prices = usePaperStore(useShallow((s) => s.prices));
  const marketInfo = usePaperStore(useShallow((s) => s.marketInfo));
  const connectionStatus = usePaperStore(useShallow((s) => s.connectionStatus));

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

  // Active position for dynamic heading
  const activePosition = usePaperStore(useShallow((s) => s.activePosition));

  if (!isInitialized || !isValidMarket) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Redirecting...</p>
      </div>
    );
  }

  const slug = market as MarketSlug;
  const priceData = prices[slug];
  const info = marketInfo[slug];

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
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-text-secondary"
              >
                <path
                  d="M10 12L6 8L10 4"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <MarketPriceBar
                market={slug}
                priceData={priceData}
                marketInfo={info}
                connectionStatus={connectionStatus}
              />
            </div>
          </div>

          {/* Two-column layout on desktop, stacked on mobile */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
            {/* Left: Real-time Price Chart */}
            <div className="hidden lg:block">
              <div className="sticky top-20">
                <PriceChart market={slug} priceData={priceData} />
              </div>
            </div>

            {/* Right: Order Entry Form */}
            <div className="lg:sticky lg:top-20 lg:self-start">
              <div className="rounded-xl border border-border-primary bg-bg-card p-5">
                <h2 className="mb-4 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                  {activePosition ? "Position" : "Place Order"}
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
