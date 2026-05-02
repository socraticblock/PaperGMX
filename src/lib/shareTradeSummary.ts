import type { ClosedTrade } from "@/types";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice } from "@/lib/format";

/**
 * Plain-text summary of a closed trade for clipboard / social paste.
 * Keeps lines short for Twitter-style posts and chat apps.
 */
export function formatClosedTradeShareText(trade: ClosedTrade): string {
  const m = MARKETS[trade.market];
  const side = trade.direction === "long" ? "Long" : "Short";
  const reasonLabel =
    trade.closeReason === "liquidated"
      ? "Liquidated"
      : trade.closeReason === "take_profit"
        ? "Take profit"
        : "Cut loss";

  return [
    `PaperGMX — ${m.symbol} ${side} · ${trade.leverage}x`,
    `Net P&L: ${formatUSD(trade.netPnl)} (${reasonLabel})`,
    `Entry → Exit: $${formatPrice(trade.entryPrice, m.decimals)} → $${formatPrice(trade.exitPrice, m.decimals)}`,
    "SIMULATION — practice for GMX V2 perpetuals · papergmx",
  ].join("\n");
}

export async function copyTradeSummaryToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
    return false;
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
