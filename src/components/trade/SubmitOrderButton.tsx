"use client";

import { memo, useCallback, useRef, useEffect } from "react";
import type { OrderDirection, OrderStatus, USD, MarketSlug, BPS, PriceData, MarketInfo, Position } from "@/types";
import { usd, timestamp } from "@/lib/branded";
import { formatUSD } from "@/lib/format";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateAcceptablePrice,
  calculateLiquidationPrice,
  determineFillPrice,
} from "@/lib/calculations";
import { MARKETS, DEFAULT_POSITION_FEE_BPS, SLIPPAGE_OPEN_BPS, KEEPER_TIMING_WEIGHTS, generatePositionId } from "@/lib/constants";
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
  needsApproval: boolean;
  onSubmit: (position: Position) => void;
  onStatusChange: (status: OrderStatus) => void;
  simulateKeeperDelay: boolean;
}

// ─── Keeper delay sampling (uses KEEPER_TIMING_WEIGHTS from constants) ──

function sampleKeeperDelay(): number {
  const totalWeight = KEEPER_TIMING_WEIGHTS.reduce((sum, d) => sum + d.weight, 0);
  let random = Math.random() * totalWeight;

  for (const delay of KEEPER_TIMING_WEIGHTS) {
    random -= delay.weight;
    if (random <= 0) return delay.seconds * 1000;
  }
  return 3000;
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
  needsApproval,
  onSubmit,
  onStatusChange,
  simulateKeeperDelay,
}: SubmitOrderButtonProps) {
  const marketConfig = MARKETS[market];
  const sizeUsd = calculatePositionSize(collateralUsd, leverage);
  const isLong = direction === "long";

  // ─── Refs for latest values in async keeper execution ────
  // The keeper useEffect captures values from the closure, which go stale
  // after the first `await`. We track the real-time values via refs.
  const priceDataRef = useRef(priceData);
  priceDataRef.current = priceData;
  const marketInfoRef = useRef(marketInfo);
  marketInfoRef.current = marketInfo;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const collateralUsdRef = useRef(collateralUsd);
  collateralUsdRef.current = collateralUsd;
  const leverageRef = useRef(leverage);
  leverageRef.current = leverage;
  const marketRef = useRef(market);
  marketRef.current = market;
  const sizeUsdRef = useRef(sizeUsd);
  sizeUsdRef.current = sizeUsd;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onStatusChangeRef = useRef(onStatusChange);
  onStatusChangeRef.current = onStatusChange;
  const simulateKeeperDelayRef = useRef(simulateKeeperDelay);
  simulateKeeperDelayRef.current = simulateKeeperDelay;

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

  // ─── Button click: start the wallet flow ────────────────
  // Phase 4: approval and signing are handled by wallet popups,
  // not inline in this handler. We just set the initial status.
  const handleClick = useCallback(() => {
    if (!canSubmit) return;

    if (needsApproval) {
      onStatusChange("approving"); // Triggers ApprovalPopup
    } else {
      onStatusChange("signing"); // Skip approval, go to signing
    }
  }, [canSubmit, needsApproval, onStatusChange]);

  // ─── Keeper execution after signing is confirmed ────────
  // When orderStatus becomes "submitted", the wallet signing popup
  // was confirmed. Now we run the keeper steps and fill the order.
  const keeperStartedRef = useRef(false);

  useEffect(() => {
    if (orderStatus !== "submitted") {
      keeperStartedRef.current = false;
      return;
    }
    // Prevent double-execution (React StrictMode calls effects twice in dev)
    if (keeperStartedRef.current) return;
    keeperStartedRef.current = true;

    let cancelled = false;

    const runKeeper = async () => {
      // Step 1: Keeper steps (simulated delay)
      if (simulateKeeperDelayRef.current) {
        const delay = sampleKeeperDelay();
        const stepDelay = delay / 4;

        for (let step = 1; step <= 4; step++) {
          await new Promise((r) => setTimeout(r, stepDelay));
          if (cancelled) return;
          onStatusChangeRef.current(`keeper_step_${step}` as OrderStatus);
        }
      } else {
        for (let step = 1; step <= 4; step++) {
          onStatusChangeRef.current(`keeper_step_${step}` as OrderStatus);
        }
      }

      if (cancelled) return;

      // Step 2: Fill price from oracle (using CURRENT prices, not stale)
      const currentPriceData = priceDataRef.current;
      const currentMarketInfo = marketInfoRef.current;
      if (!currentPriceData || currentPriceData.last <= 0) {
        onStatusChangeRef.current("failed");
        return;
      }

      const fillPrice = determineFillPrice(
        currentPriceData.min,
        currentPriceData.max,
        directionRef.current,
        false
      );
      const acceptablePrice = calculateAcceptablePrice(
        fillPrice,
        SLIPPAGE_OPEN_BPS,
        directionRef.current,
        false
      );
      const feeBps: BPS = currentMarketInfo?.positionFeeBps ?? DEFAULT_POSITION_FEE_BPS;
      const positionFeePaid = calculatePositionFee(sizeUsdRef.current, feeBps);
      const currentMarketConfig = MARKETS[marketRef.current];

      // Calculate liquidation price at open
      const liquidationPrice = calculateLiquidationPrice(
        directionRef.current,
        fillPrice,
        collateralUsdRef.current,
        sizeUsdRef.current,
        currentMarketConfig.maintenanceMarginBps,
        positionFeePaid,
        usd(0) // No accrued fees at open
      );

      // Step 3: Create position
      const position: Position = {
        id: generatePositionId(marketRef.current, directionRef.current),
        market: marketRef.current,
        direction: directionRef.current,
        collateralUsd: collateralUsdRef.current,
        leverage: leverageRef.current,
        sizeUsd: sizeUsdRef.current,
        entryPrice: fillPrice,
        acceptablePrice,
        liquidationPrice,
        positionFeeBps: feeBps,
        positionFeePaid,
        borrowFeeAccrued: usd(0),
        fundingFeeAccrued: usd(0),
        openedAt: timestamp(Date.now()),
        confirmedAt: timestamp(Date.now()),
        status: "active",
      };

      onSubmitRef.current(position);
      onStatusChangeRef.current("filled");
    };

    runKeeper();

    return () => {
      cancelled = true;
    };
    // We intentionally only depend on orderStatus so this effect
    // only fires when the status transitions to "submitted".
    // All other values are accessed via refs to avoid re-triggering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderStatus]);

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
          text: "Confirm in Wallet...",
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
      case "cancelled":
        return {
          text: "Order Cancelled",
          bgClass: "bg-border-primary",
          showSpinner: false,
        };
      default: {
        // idle or other — show actionable states
        if (collateralUsd <= 0) {
          return {
            text: "Enter Amount",
            bgClass: "bg-border-primary cursor-not-allowed",
            showSpinner: false,
          };
        }
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
        if (needsApproval) {
          return {
            text: "Approve USDC",
            bgClass: "bg-yellow-primary",
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
        onClick={handleClick}
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
