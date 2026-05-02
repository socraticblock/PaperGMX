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
import TradeBottomTabs from "@/components/trade/TradeBottomTabs";
import { Panel, PanelHeader } from "@/components/trade/ui";
import type { MarketSlug } from "@/types";

export default function TradePage() {
  const router = useRouter();
  const marketParam = useParams().market;
  const market = Array.isArray(marketParam) ? marketParam[0] : marketParam;
  const isInitialized = usePaperStore(useShallow((s) => s.isInitialized));
  const prices = usePaperStore(useShallow((s) => s.prices));
  const marketInfo = usePaperStore(useShallow((s) => s.marketInfo));
  const connectionStatus = usePaperStore(useShallow((s) => s.connectionStatus));

  usePriceService();

  useEffect(() => {
    if (!isInitialized) {
      router.push("/");
    }
  }, [isInitialized, router]);

  const isValidMarket = MARKET_SLUGS.includes(market as MarketSlug);

  useEffect(() => {
    if (isInitialized && !isValidMarket) {
      router.push("/markets");
    }
  }, [isInitialized, isValidMarket, router]);

  const activePosition = usePaperStore(useShallow((s) => s.activePosition));

  if (!isInitialized || !isValidMarket) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-trade-page">
        <p className="text-[length:var(--text-trade-body)] text-text-muted">
          Redirecting...
        </p>
      </div>
    );
  }

  const slug = market as MarketSlug;
  const priceData = prices[slug];
  const info = marketInfo[slug];

  return (
    <div className="flex min-h-screen flex-col bg-trade-page">
      <Header />
      <SettingsPanel />

      <main className="flex-1">
        <div className="border-b border-trade-border-subtle bg-trade-page">
          <div className="mx-auto flex max-w-[1920px] items-stretch gap-2 px-3 py-2 md:gap-3 md:px-5 lg:px-6">
            <button
              type="button"
              onClick={() => router.push("/markets")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-trade-border-subtle bg-trade-strip text-text-secondary transition-colors hover:border-trade-border-active hover:text-text-primary"
              aria-label="Back to markets"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="text-current"
                aria-hidden="true"
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
            <div className="min-w-0 flex-1">
              <MarketPriceBar
                market={slug}
                priceData={priceData}
                marketInfo={info}
                connectionStatus={connectionStatus}
              />
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-[1920px] px-3 py-3 md:px-5 lg:px-6 lg:py-4">
          <div className="flex flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_min(420px,100%)] xl:items-start xl:gap-4">
            <div className="order-2 flex min-w-0 flex-col xl:order-1">
              <PriceChart
                market={slug}
                priceData={priceData}
                positionOverlay={
                  activePosition
                    ? {
                        entryPrice: Number(activePosition.entryPrice),
                        liquidationPrice:
                          activePosition.liquidationPrice != null
                            ? Number(activePosition.liquidationPrice)
                            : null,
                      }
                    : null
                }
              />
              <TradeBottomTabs />
            </div>

            <aside className="order-1 w-full min-w-0 xl:sticky xl:order-2 xl:top-14 xl:self-start">
              <Panel padding="none" className="overflow-hidden">
                <PanelHeader>
                  <span className="text-[length:var(--text-trade-body)] font-semibold text-text-primary">
                    {activePosition ? "Position" : "Trade"}
                  </span>
                </PanelHeader>
                <div className="p-3 md:p-4">
                  <OrderEntryForm market={slug} />
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-trade-border-subtle bg-trade-page px-4 py-3 text-center">
        <a
          href="https://app.gmx.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[length:var(--text-trade-stat)] text-text-muted transition-colors hover:text-blue-primary"
        >
          Ready for real trading? Switch to GMX →
        </a>
      </footer>
    </div>
  );
}
