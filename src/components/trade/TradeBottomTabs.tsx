"use client";

import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePaperStore } from "@/store/usePaperStore";
import { Panel } from "@/components/trade/ui";
import { formatUSD, formatPrice } from "@/lib/format";
import { MARKETS } from "@/lib/constants";
import type { ClosedTrade } from "@/types";
import { getMarkPrice } from "@/lib/positionEngine";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import { addUSD } from "@/lib/branded";
import ShareTradeSummaryButton from "@/components/trade/ShareTradeSummaryButton";

const TABS = [
  { id: "positions", label: "Positions" },
  { id: "orders", label: "Orders" },
  { id: "trades", label: "Trades" },
  { id: "claims", label: "Claims" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export interface TradeBottomTabsProps {
  showChartPositions?: boolean;
  onShowChartPositionsChange?: (value: boolean) => void;
}

function ClosedTradeRow({ trade }: { trade: ClosedTrade }) {
  const m = MARKETS[trade.market];
  const side = trade.direction === "long" ? "Long" : "Short";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-trade-border-subtle py-2.5 text-[length:var(--text-trade-body)] last:border-b-0">
      <span className="min-w-0 font-medium text-text-primary">
        {m.symbol}{" "}
        <span
          className={
            trade.direction === "long" ? "text-green-primary" : "text-red-primary"
          }
        >
          {side}
        </span>
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`tabular-nums ${trade.netPnl >= 0 ? "text-green-primary" : "text-red-primary"}`}
        >
          {formatUSD(trade.netPnl)}
        </span>
        <ShareTradeSummaryButton trade={trade} compact />
      </div>
    </div>
  );
}

function TradeBottomTabsInner({
  showChartPositions = true,
  onShowChartPositionsChange,
}: TradeBottomTabsProps) {
  const [active, setActive] = useState<TabId>("positions");
  const { activePosition, tradeHistory, prices, marketInfo } = usePaperStore(
    useShallow((s) => ({
      activePosition: s.activePosition,
      tradeHistory: s.tradeHistory,
      prices: s.prices,
      marketInfo: s.marketInfo,
    })),
  );

  const pnl = usePositionPnl(activePosition, prices, marketInfo);
  const netValueUsd =
    activePosition && pnl.currentPrice != null && pnl.currentPrice > 0
      ? addUSD(activePosition.collateralUsd, pnl.netPnl)
      : null;

  const recentTrades = tradeHistory.slice(0, 8);
  const posCount = activePosition ? 1 : 0;
  const markPriceData = activePosition
    ? prices[activePosition.market]
    : undefined;
  const mark = markPriceData ? Number(getMarkPrice(markPriceData)) : 0;

  return (
    <Panel padding="none" className="mt-3 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-trade-border-subtle bg-trade-strip px-2 pr-3">
        <div
          role="tablist"
          className="scrollbar-none flex min-w-0 flex-1 overflow-x-auto"
        >
          {TABS.map((tab) => {
            const isActive = tab.id === active;
            const label =
              tab.id === "positions" ? `Positions (${posCount})` : tab.label;
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
                {label}
              </button>
            );
          })}
        </div>
        {onShowChartPositionsChange && (
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[length:var(--text-trade-label)] text-text-muted">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-trade-border-subtle bg-trade-panel"
              checked={showChartPositions}
              onChange={(e) => onShowChartPositionsChange(e.target.checked)}
            />
            Chart positions
          </label>
        )}
      </div>

      <div className="min-h-[140px] p-0">
        {active === "positions" && (
          <>
            {!activePosition ? (
              <p className="p-6 text-center text-[length:var(--text-trade-body)] text-text-muted">
                No open positions
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-left text-[length:var(--text-trade-body)]">
                  <thead>
                    <tr className="border-b border-trade-border-subtle text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 font-medium">Position</th>
                      <th className="px-3 py-2 font-medium">Size</th>
                      <th className="hidden px-3 py-2 font-medium lg:table-cell">
                        Net value
                      </th>
                      <th className="px-3 py-2 font-medium">Margin</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">
                        Entry price
                      </th>
                      <th className="px-3 py-2 font-medium">Mark price</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-trade-border-subtle">
                      <td className="px-3 py-3 font-medium text-text-primary">
                        {MARKETS[activePosition.market].symbol}{" "}
                        <span
                          className={
                            activePosition.direction === "long"
                              ? "text-green-primary"
                              : "text-red-primary"
                          }
                        >
                          {activePosition.direction === "long" ? "Long" : "Short"}
                        </span>
                      </td>
                      <td className="px-3 py-3 tabular-nums text-text-secondary">
                        {formatUSD(activePosition.sizeUsd)}
                      </td>
                      <td
                        className="hidden px-3 py-3 tabular-nums text-text-secondary lg:table-cell"
                        title="Collateral + unrealized net P&L (after fees if closed now)"
                      >
                        {netValueUsd != null ? formatUSD(netValueUsd) : "—"}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-text-secondary">
                        {formatUSD(activePosition.collateralUsd)}
                      </td>
                      <td className="hidden px-3 py-3 tabular-nums text-text-secondary md:table-cell">
                        {formatPrice(
                          activePosition.entryPrice,
                          MARKETS[activePosition.market].decimals,
                        )}
                      </td>
                      <td className="px-3 py-3 tabular-nums text-text-secondary">
                        {mark > 0
                          ? formatPrice(
                              mark,
                              MARKETS[activePosition.market].decimals,
                            )
                          : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {active === "orders" && (
          <div
            className="p-6 text-center text-[length:var(--text-trade-body)] text-text-muted"
            role="status"
          >
            <p>
              Limit and trigger orders are not simulated in PaperGMX. All entries
              and exits use the same market order + keeper flow as the live GMX
              app.
            </p>
            <p className="mt-2 text-[length:var(--text-trade-label)]">
              Open interest and pool balances still update from live GMX data.
            </p>
          </div>
        )}

        {active === "trades" && (
          <div className="p-3 md:p-4">
            {recentTrades.length === 0 ? (
              <p className="py-8 text-center text-[length:var(--text-trade-body)] text-text-muted">
                No closed trades yet.
              </p>
            ) : (
              <div>
                {recentTrades.map((t) => (
                  <ClosedTradeRow key={t.id} trade={t} />
                ))}
              </div>
            )}
          </div>
        )}

        {active === "claims" && (
          <p className="p-6 text-center text-[length:var(--text-trade-body)] text-text-muted">
            Rewards and claims are not simulated in PaperGMX yet.
          </p>
        )}
      </div>
    </Panel>
  );
}

export const TradeBottomTabs = memo(TradeBottomTabsInner);
export default TradeBottomTabs;
