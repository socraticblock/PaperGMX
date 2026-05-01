"use client";

import { motion } from "framer-motion";
import type { Position, Percent, Price, PriceData, MarketSlug } from "@/types";
import { MARKETS } from "@/lib/constants";
import { formatPercent, formatPrice } from "@/lib/format";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

// ─── Props ───────────────────────────────────────────────

export interface MarginWarningProps {
  /** The active position */
  position: Position;
  /** Distance to liquidation as a percentage */
  distanceToLiq: Percent;
  /** Current prices */
  prices: Record<MarketSlug, PriceData>;
  /** Recalculated liquidation price (accounts for accrued fees) */
  recalculatedLiqPrice?: Price | null;
}

// ─── Thresholds ──────────────────────────────────────────

const WARNING_THRESHOLD = 15; // Show warning when distance < 15%
const CRITICAL_THRESHOLD = 8; // Critical (red) when distance < 8%

// ─── Component ───────────────────────────────────────────

export function MarginWarning({ position, distanceToLiq, prices, recalculatedLiqPrice }: MarginWarningProps) {
  const marketConfig = MARKETS[position.market];
  const distance = distanceToLiq as number;

  // Don't show if distance is safe or position is already liquidated
  if (distance >= WARNING_THRESHOLD || distance <= 0) return null;

  const isCritical = distance < CRITICAL_THRESHOLD;

  // Calculate estimated price move needed to reach liquidation
  const priceData = prices[position.market];
  const currentPrice = priceData
    ? position.direction === "long"
      ? priceData.min
      : priceData.max
    : 0;

  const liquidationPrice = recalculatedLiqPrice ?? position.liquidationPrice;

  // Estimated price move from current to liquidation
  let priceMoveStr = "";
  if (currentPrice > 0 && liquidationPrice !== null && liquidationPrice > 0) {
    const move = Math.abs(currentPrice - liquidationPrice);
    const movePercent = (move / currentPrice) * 100;
    priceMoveStr = `$${formatPrice(move, marketConfig.decimals)} (${formatPercent(movePercent)})`;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={`rounded-lg border px-3 py-2.5 space-y-1.5 ${
        isCritical
          ? "bg-red-primary/10 border-red-primary/40"
          : "bg-yellow-primary/10 border-yellow-primary/30"
      }`}
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        <motion.div
          animate={isCritical ? { scale: [1, 1.2, 1] } : {}}
          transition={isCritical ? { repeat: Infinity, duration: 1.5, ease: "easeInOut" } : {}}
        >
          <ExclamationTriangleIcon
            className={`h-4 w-4 flex-shrink-0 ${
              isCritical ? "text-red-primary" : "text-yellow-primary"
            }`}
            aria-hidden="true"
          />
        </motion.div>
        <span
          className={`text-xs font-bold ${
            isCritical ? "text-red-primary" : "text-yellow-primary"
          }`}
        >
          {isCritical
            ? "CRITICAL: Liquidation Imminent"
            : "Approaching Liquidation"}
        </span>
      </div>

      {/* Details */}
      <div className="flex items-center justify-between pl-6">
        <span
          className={`text-[10px] ${
            isCritical ? "text-red-primary/80" : "text-yellow-primary/80"
          }`}
        >
          Distance to Liq.
        </span>
        <span
          className={`text-[10px] font-mono font-bold ${
            isCritical ? "text-red-primary" : "text-yellow-primary"
          }`}
        >
          {formatPercent(distanceToLiq)}
        </span>
      </div>

      {priceMoveStr && (
        <div className="flex items-center justify-between pl-6">
          <span
            className={`text-[10px] ${
              isCritical ? "text-red-primary/80" : "text-yellow-primary/80"
            }`}
          >
            Price move to Liq.
          </span>
          <span
            className={`text-[10px] font-mono ${
              isCritical ? "text-red-primary/90" : "text-yellow-primary/90"
            }`}
          >
            {priceMoveStr}
          </span>
        </div>
      )}

      {/* Warning message */}
      <p
        className={`text-[10px] leading-relaxed pl-6 ${
          isCritical ? "text-red-primary/70" : "text-yellow-primary/70"
        }`}
      >
        {isCritical
          ? "Your position is extremely close to liquidation. Consider cutting your loss immediately."
          : "Your position is approaching the liquidation zone. Monitor closely or reduce position size."}
      </p>
    </motion.div>
  );
}

export default MarginWarning;
