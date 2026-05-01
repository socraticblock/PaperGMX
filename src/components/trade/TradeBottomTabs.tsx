"use client";

import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePaperStore } from "@/store/usePaperStore";
import { Panel } from "@/components/trade/ui";
import { formatUSD, formatPrice } from "@/lib/format";
import { MARKETS } from "@/lib/constants";
import type { ClosedTrade } from "@/types";

const TABS = [
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Orders" },
  { id: "trades", label: "Trades" },
  { id: "claims", label: "Claims" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function ClosedTradeRow({ trade }: { trade: ClosedTrade }) {
  const m = MARKETS[trade.market];
  const side = trade.direction === "long" ? "Long" : "Short";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-trade-border-subtle py-2.5 text-[length:var(--text-trade-body)] last:border-b-0">
      <span className="font-medium text-text-primary">
        {m.symbol}{" "}
        <span
          className={
            trade.direction === "long" ? "text-green-primary" : "text-red-primary"
          }
        >
          {side}
        </span>
      </span>
      <span
        className={`tabular-nums ${trade.netPnl >= 0 ? "text-green-primary" : "text-red-primary"}`}
      >
        {formatUSD(trade.netPnl)}
      </span>
    </div>
  );
}

function TradeBottomTabsInner() {
  const [active, setActive] = useState<TabId>("positions");
  const { activePosition, tradeHistory } = usePaperStore(
    useShallow((s) => ({
      activePosition: s.activePosition,
      tradeHistory: s.tradeHistory,
    })),
  );

  const recentTrades = tradeHistory.slice(0, 8);

  return (
    <Panel padding="none" className="mt-3 overflow-hidden">
      <div
        role="tablist"
        className="scrollbar-none flex overflow-x-auto border-b border-trade-border-subtle bg-trade-strip px-2"
      >
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(tab.id)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-[length:var(--text-trade-body)] font-medium transition-colors ${
                isActive
                  ? "border-blue-primary text-text-primary"
                  : "border-transparent text-text-muted hover:text-text-secondary"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-[132px] p-3 md:p-4">
        {active === "positions" && (
          <>
            {!activePosition ? (
              <p className="text-center text-[length:var(--text-trade-body)] text-text-muted py-8">
                You have no open positions.
              </p>
            ) : (
              <div className="space-y-2 text-[length:var(--text-trade-body)]">
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted">Market</span>
                  <span className="font-medium text-text-primary">
                    {MARKETS[activePosition.market].pair}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-muted">Side</span>
                  <span
                    className={
                      activePosition.direction === "long"
                        ? "font-medium text-green-primary"
                        : "font-medium text-red-primary"
                    }
                  >
                    {activePosition.direction === "long" ? "Long" : "Short"}
                  </span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-text-muted">Size</span>
                  <span className="text-text-secondary">{formatUSD(activePosition.sizeUsd)}</span>
                </div>
                <div className="flex justify-between gap-2 tabular-nums">
                  <span className="text-text-muted">Entry</span>
                  <span className="text-text-secondary">
                    {formatPrice(activePosition.entryPrice, MARKETS[activePosition.market].decimals)}
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {active === "orders" && (
          <p className="text-center text-[length:var(--text-trade-body)] text-text-muted py-8">
            Open limit orders are not simulated yet. Keeper flow handles market opens and closes only.
          </p>
        )}

        {active === "trades" && (
          <>
            {recentTrades.length === 0 ? (
              <p className="text-center text-[length:var(--text-trade-body)] text-text-muted py-8">
                No closed trades yet.
              </p>
            ) : (
              <div>
                {recentTrades.map((t) => (
                  <ClosedTradeRow key={t.id} trade={t} />
                ))}
              </div>
            )}
          </>
        )}

        {active === "claims" && (
          <p className="text-center text-[length:var(--text-trade-body)] text-text-muted py-8">
            Rewards and fee rebates are placeholders for this simulator.
          </p>
        )}
      </div>
    </Panel>
  );
}

export const TradeBottomTabs = memo(TradeBottomTabsInner);
export default TradeBottomTabs;
