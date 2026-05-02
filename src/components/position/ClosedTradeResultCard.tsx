"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { ClosedTrade } from "@/types";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice } from "@/lib/format";
import ShareTradeSummaryButton from "@/components/trade/ShareTradeSummaryButton";

export interface ClosedTradeResultCardProps {
  trade: ClosedTrade;
  onDismiss: () => void;
}

/**
 * Shown after a successful manual close when the position panel unmounts before
 * the close-specific result UI inside ClosePositionForm can render.
 */
function ClosedTradeResultCardInner({
  trade,
  onDismiss,
}: ClosedTradeResultCardProps) {
  const m = MARKETS[trade.market];
  const pnlPositive = trade.netPnl >= 0;

  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-6 space-y-5">
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-primary/20"
        >
          <svg
            className="h-6 w-6 text-green-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </motion.div>

        <h3 className="mt-3 text-sm font-semibold text-text-primary">Position closed</h3>
        <p className="mt-1 text-xs text-text-muted">
          {m.pair} · {trade.leverage}x {trade.direction === "long" ? "Long" : "Short"}
        </p>
      </div>

      <div className="rounded-lg bg-bg-input px-4 py-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Net P&amp;L</span>
          <span
            className={`text-xs font-mono font-semibold ${
              pnlPositive ? "text-green-primary" : "text-red-primary"
            }`}
          >
            {formatUSD(trade.netPnl)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Entry → Exit</span>
          <span className="text-xs font-mono text-text-secondary">
            ${formatPrice(trade.entryPrice, m.decimals)} → $
            {formatPrice(trade.exitPrice, m.decimals)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-muted">Returned (incl. P&amp;L)</span>
          <span className="text-xs font-mono text-text-secondary">
            {formatUSD(trade.returnedCollateral)}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
        <ShareTradeSummaryButton trade={trade} />
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="w-full rounded-xl bg-green-primary py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
      >
        Done
      </button>
    </div>
  );
}

export const ClosedTradeResultCard = memo(ClosedTradeResultCardInner);
export default ClosedTradeResultCard;
