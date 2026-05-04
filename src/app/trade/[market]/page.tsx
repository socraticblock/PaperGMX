"use client";

import { useEffect, useState } from "react";
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
import { PositionsList } from "@/components/position/PositionsList";
import { PositionCard } from "@/components/position/PositionCard";
import { ClosePositionForm } from "@/components/position/ClosePositionForm";
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

  const positions = usePaperStore(useShallow((s) => s.positions));
  const selectedPositionId = usePaperStore(
    useShallow((s) => s.selectedPositionId),
  );
  const selectPosition = usePaperStore(useShallow((s) => s.selectPosition));
  const [chartPositionsOnChart, setChartPositionsOnChart] = useState(true);

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

  // Positions belonging to the route market — drives chart overlay and the
  // managed position card / close form. Prefer the user's selection when
  // it's on this market; otherwise pick the first market-matching position.
  const positionsOnThisMarket = positions.filter((p) => p.market === slug);
  const overlayPosition =
    positionsOnThisMarket.find((p) => p.id === selectedPositionId) ??
    positionsOnThisMarket[0] ??
    null;

  return (
    <div className="flex min-h-screen flex-col bg-trade-page">
      <Header />
      <SettingsPanel />

      <main className="flex-1">
        <div className="border-b border-trade-border-subtle bg-trade-page">
          <div className="app-canvas flex items-stretch gap-2 py-2 md:gap-3">
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

        <div className="app-canvas py-3 lg:py-4">
          <div className="flex w-full flex-col gap-3 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] xl:items-start xl:justify-center xl:gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(420px,500px)]">
            <div className="order-2 flex min-w-0 flex-col xl:order-1">
              <PriceChart
                market={slug}
                priceData={priceData}
                positionOverlay={
                  chartPositionsOnChart && overlayPosition
                    ? {
                        entryPrice: Number(overlayPosition.entryPrice),
                        liquidationPrice:
                          overlayPosition.liquidationPrice != null
                            ? Number(overlayPosition.liquidationPrice)
                            : null,
                      }
                    : null
                }
              />
              <TradeBottomTabs
                showChartPositions={chartPositionsOnChart}
                onShowChartPositionsChange={setChartPositionsOnChart}
              />
            </div>

            <aside className="order-1 w-full min-w-0 space-y-3 xl:sticky xl:order-2 xl:top-14 xl:self-start">
              {/* Trade box — always available; supports new opens and increases */}
              <Panel padding="none" className="overflow-hidden">
                <PanelHeader>
                  <span className="text-[length:var(--text-trade-body)] font-semibold text-text-primary">
                    Trade
                  </span>
                </PanelHeader>
                <div className="p-3 md:p-4">
                  <OrderEntryForm market={slug} />
                </div>
              </Panel>

              {/* All open positions across markets — selectable */}
              {positions.length > 0 && (
                <Panel padding="none" className="overflow-hidden">
                  <div className="p-3 md:p-4">
                    <PositionsList
                      positions={positions}
                      prices={prices}
                      marketInfo={marketInfo}
                      selectedPositionId={selectedPositionId}
                      onSelect={selectPosition}
                    />
                  </div>
                </Panel>
              )}

              {/* Manage panel — visible when the selected position is on this market */}
              {overlayPosition && (
                <Panel padding="none" className="overflow-hidden">
                  <PanelHeader>
                    <span className="text-[length:var(--text-trade-body)] font-semibold text-text-primary">
                      Manage position
                    </span>
                  </PanelHeader>
                  <div className="space-y-4 p-3 md:p-4">
                    <PositionCard
                      position={overlayPosition}
                      prices={prices}
                      marketInfo={marketInfo}
                    />
                    <ClosePositionForm
                      position={overlayPosition}
                      prices={prices}
                      marketInfo={marketInfo}
                    />
                  </div>
                </Panel>
              )}
            </aside>
          </div>
        </div>
      </main>

      <footer className="mt-auto border-t border-trade-border-subtle bg-trade-page">
        <div className="app-canvas py-3 text-center">
          <a
            href="https://app.gmx.io"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[length:var(--text-trade-stat)] text-text-muted transition-colors hover:text-blue-primary"
          >
            Ready for real trading? Switch to GMX →
          </a>
        </div>
      </footer>
    </div>
  );
}
