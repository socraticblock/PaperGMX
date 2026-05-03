"use client";

import { memo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { usePaperStore } from "@/store/usePaperStore";
import { Panel } from "@/components/trade/ui";
import { formatUSD, formatPrice } from "@/lib/format";
import { MARKETS } from "@/lib/constants";
import type {
  ClosedTrade,
  MarketInfo,
  MarketSlug,
  Position,
  PriceData,
} from "@/types";
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

/** Memoized row — receives primitives so price ticks don’t rebuild unrelated cells. */
const OpenPositionTableRow = memo(function OpenPositionTableRow({
  position,
  prices,
  marketInfo,
  isSelected,
  onSelect,
}: {
  position: Position;
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";
  const pnl = usePositionPnl(position, prices, marketInfo);
  const markPriceData = prices[position.market];
  const mark = markPriceData ? Number(getMarkPrice(markPriceData)) : 0;
  const netValueUsd =
    pnl.currentPrice != null && pnl.currentPrice > 0
      ? Number(addUSD(position.collateralUsd, pnl.netPnl))
      : null;

  const sideCls = isLong ? "text-green-primary" : "text-red-primary";
  const pnlCls = pnl.netPnl >= 0 ? "text-green-primary" : "text-red-primary";

  return (
    <tr
      onClick={() => onSelect(position.id)}
      className={`cursor-pointer border-b border-trade-border-subtle transition-colors hover:bg-trade-raised ${
        isSelected ? "bg-trade-raised/60" : ""
      }`}
      aria-selected={isSelected}
    >
      <td className="px-3 py-3 font-medium text-text-primary">
        {marketConfig.symbol}{" "}
        <span className={sideCls}>{isLong ? "Long" : "Short"}</span>
      </td>
      <td
        className="hidden px-3 py-3 tabular-nums text-text-secondary lg:table-cell"
        title="Collateral + unrealized net P&L (after fees if closed now)"
      >
        {netValueUsd != null ? formatUSD(netValueUsd) : "—"}
      </td>
      <td
        className={`hidden px-3 py-3 tabular-nums md:table-cell ${pnlCls}`}
        title="Unrealized net P&L (includes accrued borrow/funding vs close)"
      >
        {formatUSD(pnl.netPnl)}
      </td>
      <td className="px-3 py-3 tabular-nums text-text-secondary">
        {formatUSD(position.sizeUsd)}
      </td>
      <td className="px-3 py-3 tabular-nums text-text-secondary">
        {formatUSD(position.collateralUsd)}
      </td>
      <td className="hidden px-3 py-3 tabular-nums text-text-secondary md:table-cell">
        {formatPrice(position.entryPrice, marketConfig.decimals)}
      </td>
      <td className="px-3 py-3 tabular-nums text-text-secondary">
        {mark > 0 ? formatPrice(mark, marketConfig.decimals) : "—"}
      </td>
    </tr>
  );
});

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
  const {
    positions,
    selectedPositionId,
    selectPosition,
    tradeHistory,
    prices,
    marketInfo,
  } = usePaperStore(
    useShallow((s) => ({
      positions: s.positions,
      selectedPositionId: s.selectedPositionId,
      selectPosition: s.selectPosition,
      tradeHistory: s.tradeHistory,
      prices: s.prices,
      marketInfo: s.marketInfo,
    })),
  );

  const recentTrades = tradeHistory.slice(0, 8);
  const posCount = positions.length;

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
            {positions.length === 0 ? (
              <p className="p-6 text-center text-[length:var(--text-trade-body)] text-text-muted">
                No open positions
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-[length:var(--text-trade-body)]">
                  <thead>
                    <tr className="border-b border-trade-border-subtle text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                      <th className="px-3 py-2 font-medium">Asset</th>
                      <th className="hidden px-3 py-2 font-medium lg:table-cell">
                        Net value
                      </th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">
                        Unrealized P&amp;L
                      </th>
                      <th className="px-3 py-2 font-medium">Size</th>
                      <th className="px-3 py-2 font-medium">Margin</th>
                      <th className="hidden px-3 py-2 font-medium md:table-cell">
                        Entry
                      </th>
                      <th className="px-3 py-2 font-medium">Mark</th>
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((p) => (
                      <OpenPositionTableRow
                        key={p.id}
                        position={p}
                        prices={prices}
                        marketInfo={marketInfo}
                        isSelected={p.id === selectedPositionId}
                        onSelect={selectPosition}
                      />
                    ))}
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
