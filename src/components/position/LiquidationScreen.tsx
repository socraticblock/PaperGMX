"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ClosedTrade, MarketSlug, PriceData } from "@/types";
import { MARKETS } from "@/lib/constants";
import { formatUSD, formatPrice } from "@/lib/format";
import {
  ExclamationTriangleIcon,
  FireIcon,
  ArrowTrendingDownIcon,
  ArrowTrendingUpIcon,
} from "@heroicons/react/24/outline";

// ─── Props ───────────────────────────────────────────────

export interface LiquidationScreenProps {
  /** The last closed trade (from tradeHistory) — must have closeReason="liquidated" */
  trade: ClosedTrade;
  /** Current prices for display context */
  prices: Record<MarketSlug, PriceData>;
  /** Callback when user dismisses the screen */
  onDismiss: () => void;
}

// ─── Component ───────────────────────────────────────────

export function LiquidationScreen({ trade, onDismiss }: LiquidationScreenProps) {
  const marketConfig = MARKETS[trade.market];
  const isLong = trade.direction === "long";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300, delay: 0.1 }}
          className="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-red-primary/40 bg-bg-card"
        >
          {/* Red pulse overlay */}
          <motion.div
            animate={{
              opacity: [0.05, 0.15, 0.05],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: "easeInOut",
            }}
            className="absolute inset-0 bg-red-primary/10 pointer-events-none"
          />

          <div className="relative z-10 p-6 space-y-6">
            {/* ─── Title ─────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center space-y-3"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  damping: 12,
                  stiffness: 200,
                  delay: 0.3,
                }}
                className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-primary/20 border-2 border-red-primary/50"
              >
                <ExclamationTriangleIcon className="h-8 w-8 text-red-primary" aria-hidden="true" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, letterSpacing: "0.3em" }}
                animate={{ opacity: 1, letterSpacing: "0.15em" }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="text-xl font-black text-red-primary uppercase"
              >
                Position Liquidated
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                className="text-sm text-text-muted"
              >
                Your {marketConfig.pair} {isLong ? "Long" : "Short"} position has been liquidated
              </motion.p>
            </motion.div>

            {/* ─── Position Details ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="rounded-xl bg-red-primary/5 border border-red-primary/20 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Market</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{marketConfig.icon}</span>
                  <span className="text-sm font-semibold text-text-primary">{marketConfig.pair}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Direction</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                    isLong
                      ? "bg-green-primary/20 text-green-primary"
                      : "bg-red-primary/20 text-red-primary"
                  }`}
                >
                  {isLong ? (
                    <ArrowTrendingUpIcon className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <ArrowTrendingDownIcon className="h-3 w-3" aria-hidden="true" />
                  )}
                  {isLong ? "LONG" : "SHORT"}
                </span>
              </div>

              <div className="h-px bg-border-primary/30" />

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Entry Price</span>
                <span className="text-xs font-mono text-text-secondary">
                  ${formatPrice(trade.entryPrice, marketConfig.decimals)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Exit Price (Liquidation)</span>
                <span className="text-xs font-mono text-red-primary">
                  ${formatPrice(trade.exitPrice, marketConfig.decimals)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Leverage</span>
                <span className="text-xs font-mono text-blue-primary">{trade.leverage}x</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted">Position Size</span>
                <span className="text-xs font-mono text-text-secondary">
                  {formatUSD(trade.sizeUsd)}
                </span>
              </div>
            </motion.div>

            {/* ─── Collateral Lost ──────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0 }}
              className="rounded-xl bg-bg-input p-4 text-center space-y-2"
            >
              <div className="flex items-center justify-center gap-2">
                <FireIcon className="h-5 w-5 text-red-primary" aria-hidden="true" />
                <span className="text-sm font-bold text-red-primary uppercase">
                  Collateral Returned
                </span>
              </div>
              <p className="text-2xl font-black font-mono text-red-primary">
                {formatUSD(trade.returnedCollateral ?? 0)}
              </p>
              <p className="text-[10px] text-text-muted leading-relaxed">
                Liquidation returns any remaining collateral after realized PnL
                and accrued fees.
              </p>
            </motion.div>

            {/* ─── Net P&L ──────────────────────────── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-center"
            >
              <p className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Net P&L</p>
              <p className="text-lg font-bold font-mono text-red-primary">
                {formatUSD(trade.netPnl)}
              </p>
            </motion.div>

            {/* ─── Dismiss Button ───────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
            >
              <button
                onClick={onDismiss}
                className="w-full rounded-xl bg-red-primary/10 border border-red-primary/30 py-3.5 text-sm font-bold text-red-primary transition-all hover:bg-red-primary/20 hover:border-red-primary/50 active:scale-[0.98]"
              >
                Dismiss
              </button>
              <p className="mt-2 text-center text-[10px] text-text-muted">
                Return to order entry form
              </p>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default LiquidationScreen;
