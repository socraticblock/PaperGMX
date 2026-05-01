"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { OrderDirection, USD, MarketSlug } from "@/types";
import { MARKETS } from "@/lib/constants";

// ─── Types ───────────────────────────────────────────────

interface OrderResultScreenProps {
  resultType: "failed" | "cancelled";
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  onDismiss: () => void;
}

// ─── Component ───────────────────────────────────────────

function OrderResultScreenInner({
  resultType,
  direction,
  collateralUsd,
  leverage,
  market,
  onDismiss,
}: OrderResultScreenProps) {
  const marketConfig = MARKETS[market];
  const isFailed = resultType === "failed";

  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-6 space-y-5">
      {/* Icon + Title */}
      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", damping: 12, stiffness: 200 }}
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${
            isFailed ? "bg-red-primary/20" : "bg-yellow-primary/20"
          }`}
        >
          {isFailed ? (
            <svg
              className="h-6 w-6 text-red-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          ) : (
            <svg
              className="h-6 w-6 text-yellow-primary"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
          )}
        </motion.div>

        <h3 className="mt-3 text-sm font-semibold text-text-primary">
          {isFailed ? "Order Failed" : "Order Cancelled"}
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          {isFailed
            ? "Price moved past your acceptable price. No position was opened."
            : "Your order was cancelled before execution. No funds were spent."}
        </p>
      </div>

      {/* Order details */}
      <div className="rounded-lg bg-bg-input px-4 py-3 space-y-2">
        <DetailRow label="Market" value={marketConfig.pair} />
        <DetailRow
          label="Direction"
          value={direction === "long" ? "Long" : "Short"}
        />
        <DetailRow label="Collateral" value={`$${collateralUsd.toFixed(2)}`} />
        <DetailRow label="Leverage" value={`${leverage}x`} />
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className="w-full rounded-xl bg-blue-primary py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
      >
        Try Again
      </button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-mono text-text-secondary">{value}</span>
    </div>
  );
}

export const OrderResultScreen = memo(OrderResultScreenInner);
export default OrderResultScreen;
