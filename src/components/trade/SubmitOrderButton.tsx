"use client";

import { memo, useCallback } from "react";
import type { OrderDirection, OrderStatus, USD, MarketSlug, BPS, PriceData, MarketInfo } from "@/types";
import { usd, price, timestamp } from "@/lib/branded";
import { formatUSD } from "@/lib/format";
import { isValidTransition } from "@/types";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateAcceptablePrice,
  determineFillPrice,
} from "@/lib/calculations";
import { MARKETS, DEFAULT_POSITION_FEE_BPS, SLIPPAGE_OPEN_BPS, generatePositionId } from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────

export interface SubmitOrderButtonProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  balance: USD;
  orderStatus: OrderStatus;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  onSubmit: (position: import("@/types").Position) => void;
  onStatusChange: (status: OrderStatus) => void;
  simulateKeeperDelay: boolean;
}

// ─── Keeper delay weights (same as GMX V2) ───────────────

const KEEPER_DELAYS = [
  { seconds: 2, weight: 15 },
  { seconds: 3, weight: 30 },
  { seconds: 4, weight: 25 },
  { seconds: 5, weight: 15 },
  { seconds: 6, weight: 10 },
  { seconds: 7, weight: 5 },
] as const;

function sampleKeeperDelay(): number {
  const totalWeight = KEEPER_DELAYS.reduce((sum, d) => sum + d.weight, 0);
  let random = Math.random() * totalWeight;

  for (const delay of KEEPER_DELAYS) {
    random -= delay.weight;
    if (random <= 0) return delay.seconds * 1000;
  }
  return 3000; // fallback
}

// ─── Component ────────────────────────────────────────────

function SubmitOrderButtonInner({
  direction,
  collateralUsd,
  leverage,
  market,
  balance,
  orderStatus,
  priceData,
  marketInfo,
  onSubmit,
  onStatusChange,
  simulateKeeperDelay,
}: SubmitOrderButtonProps) {
  const marketConfig = MARKETS[market];
  const sizeUsd = calculatePositionSize(collateralUsd, leverage);
  const isLong = direction === "long";

  // ─── Validation ─────────────────────────────────────────
  const hasPriceData = priceData && priceData.last > 0;
  const insufficientBalance = collateralUsd > balance;
  const belowMinimum = collateralUsd < 1;
  const canSubmit =
    hasPriceData &&
    !insufficientBalance &&
    !belowMinimum &&
    collateralUsd > 0 &&
    (orderStatus === "idle" || orderStatus === "failed");

  // ─── Submit handler ─────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!canSubmit || !priceData || priceData.last <= 0) return;

    // Step 1: Approving (simulated — we auto-approve in paper trading)
    if (isValidTransition(orderStatus, "approving")) {
      onStatusChange("approving");
    }

    // Simulate approval delay (500ms)
    await new Promise((r) => setTimeout(r, 500));

    // Step 2: Approved
    if (isValidTransition(orderStatus, "approved")) {
      onStatusChange("approved");
    }

    // Step 3: Signing (simulated)
    if (isValidTransition(orderStatus, "signing")) {
      onStatusChange("signing");
    }

    // Simulate signing delay (300ms)
    await new Promise((r) => setTimeout(r, 300));

    // Step 4: Submitted
    if (isValidTransition(orderStatus, "submitted")) {
      onStatusChange("submitted");
    }

    // Step 5: Keeper steps (simulated)
    if (simulateKeeperDelay) {
      const delay = sampleKeeperDelay();
      const stepDelay = delay / 4;

      for (let step = 1; step <= 4; step++) {
        await new Promise((r) => setTimeout(r, stepDelay));
        const stepStatus = `keeper_step_${step}` as OrderStatus;
        if (isValidTransition(orderStatus, stepStatus)) {
          onStatusChange(stepStatus);
        }
      }
    } else {
      // No delay — instant keeper
      for (let step = 1; step <= 4; step++) {
        const stepStatus = `keeper_step_${step}` as OrderStatus;
        if (isValidTransition(orderStatus, stepStatus)) {
          onStatusChange(stepStatus);
        }
      }
    }

    // Step 6: Filled — calculate and store position
    const fillPrice = determineFillPrice(priceData.min, priceData.max, direction, false);
    const acceptablePrice = calculateAcceptablePrice(fillPrice, SLIPPAGE_OPEN_BPS, direction, false);
    const feeBps: BPS = marketInfo?.positionFeeBps ?? DEFAULT_POSITION_FEE_BPS;
    const positionFeePaid = calculatePositionFee(sizeUsd, feeBps);

    const position: import("@/types").Position = {
      id: generatePositionId(market, direction),
      market,
      direction,
      collateralUsd,
      leverage,
      sizeUsd,
      entryPrice: fillPrice,
      acceptablePrice,
      liquidationPrice: price(0), // Will be computed by the trade page using OrderSummary
      positionFeeBps: feeBps,
      positionFeePaid,
      borrowFeeAccrued: usd(0),
      fundingFeeAccrued: usd(0),
      openedAt: timestamp(Date.now()),
      confirmedAt: timestamp(Date.now()),
      status: "active",
    };

    onSubmit(position);
    onStatusChange("filled");
  }, [
    canSubmit,
    priceData,
    orderStatus,
    direction,
    market,
    collateralUsd,
    sizeUsd,
    marketInfo,
    simulateKeeperDelay,
    onStatusChange,
    onSubmit,
  ]);

  // ─── Button state config ────────────────────────────────
  const buttonConfig = (() => {
    switch (orderStatus) {
      case "approving":
      case "approved":
        return {
          text: "Approving USDC...",
          bgClass: "bg-yellow-primary",
          showSpinner: true,
        };
      case "signing":
        return {
          text: "Confirming Order...",
          bgClass: "bg-blue-primary",
          showSpinner: true,
        };
      case "submitted":
      case "keeper_step_1":
      case "keeper_step_2":
      case "keeper_step_3":
      case "keeper_step_4":
        return {
          text: "Keeper Executing...",
          bgClass: "bg-blue-primary/70",
          showSpinner: true,
        };
      case "filled":
        return {
          text: "Order Filled!",
          bgClass: "bg-green-primary",
          showSpinner: false,
        };
      case "failed":
        return {
          text: "Order Failed — Try Again",
          bgClass: "bg-red-primary",
          showSpinner: false,
        };
      default: {
        if (insufficientBalance) {
          return {
            text: "Insufficient Balance",
            bgClass: "bg-border-primary cursor-not-allowed",
            showSpinner: false,
          };
        }
        if (belowMinimum) {
          return {
            text: "Minimum $1 Collateral",
            bgClass: "bg-border-primary cursor-not-allowed",
            showSpinner: false,
          };
        }
        if (!hasPriceData) {
          return {
            text: "Waiting for Price Data...",
            bgClass: "bg-border-primary cursor-not-allowed",
            showSpinner: false,
          };
        }
        return {
          text: `${isLong ? "Long" : "Short"} ${marketConfig.symbol} — ${formatUSD(sizeUsd)}`,
          bgClass: isLong ? "bg-green-primary" : "bg-red-primary",
          showSpinner: false,
        };
      }
    }
  })();

  return (
    <div>
      <motion.button
        whileHover={canSubmit ? { scale: 1.01 } : {}}
        whileTap={canSubmit ? { scale: 0.99 } : {}}
        onClick={handleSubmit}
        disabled={!canSubmit}
        className={`w-full rounded-xl py-4 text-base font-bold text-white transition-all ${buttonConfig.bgClass} ${
          canSubmit ? "hover:brightness-110 active:brightness-90" : "cursor-not-allowed"
        }`}
        aria-label={buttonConfig.text}
      >
        <span className="flex items-center justify-center gap-2">
          <AnimatePresence mode="wait">
            {buttonConfig.showSpinner && (
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
              />
            )}
          </AnimatePresence>
          {buttonConfig.text}
        </span>
      </motion.button>

      {/* Fee disclosure */}
      <p className="mt-2 text-center text-[10px] text-text-muted leading-relaxed">
        Paper trading only — no real funds at risk.
        <br />
        Position fee: {marketInfo?.positionFeeBps ?? 6} BPS. Keeper execution simulated.
      </p>
    </div>
  );
}

export const SubmitOrderButton = memo(SubmitOrderButtonInner);
export default SubmitOrderButton;
