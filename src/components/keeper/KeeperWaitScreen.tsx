"use client";

import { memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import type {
  OrderStatus,
  OrderDirection,
  USD,
  Price,
  MarketSlug,
} from "@/types";
import { usePaperStore } from "@/store/usePaperStore";
import {
  useKeeperExecution,
  type KeeperFillResult,
} from "@/hooks/useKeeperExecution";
import { MARKETS, SLIPPAGE_OPEN_BPS } from "@/lib/constants";
import { calculateAcceptablePrice } from "@/lib/calculations";

// ─── Step definitions (GMX V2 keeper flow) ───────────────

const KEEPER_STEPS = [
  { key: "submitted", label: "Order Submitted" },
  { key: "keeper_step_1", label: "Oracle Confirming Price" },
  { key: "keeper_step_2", label: "Keeper Executing" },
  { key: "keeper_step_3", label: "Position Opening" },
  { key: "keeper_step_4", label: "Position Confirmed" },
] as const;

// ─── Props ───────────────────────────────────────────────

interface KeeperWaitScreenProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  orderStatus: OrderStatus;
  simulateKeeperDelay: boolean;
  onSubmit: (result: KeeperFillResult) => void;
}

// ─── Component ───────────────────────────────────────────

function KeeperWaitScreenInner({
  direction,
  collateralUsd,
  leverage,
  market,
  orderStatus,
  simulateKeeperDelay,
  onSubmit,
}: KeeperWaitScreenProps) {
  const marketConfig = MARKETS[market];
  const isLong = direction === "long";
  const { start, cancel } = useKeeperExecution(
    direction,
    collateralUsd,
    leverage,
    market,
    simulateKeeperDelay,
    onSubmit,
  );

  // Start keeper on first render (when this screen appears, orderStatus is "submitted")
  // Compute order-time acceptable price from current oracle price
  const startedRef = useRef(false);
  const orderTimeAcceptablePriceRef = useRef<Price | null>(null);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;

      // Capture the acceptable price at order submission time
      // This is used for real slippage validation at execution time
      const currentPriceData = usePaperStore.getState().prices[market];
      if (currentPriceData && currentPriceData.last > 0) {
        const fillPrice =
          direction === "long" ? currentPriceData.max : currentPriceData.min;
        orderTimeAcceptablePriceRef.current = calculateAcceptablePrice(
          fillPrice,
          SLIPPAGE_OPEN_BPS,
          direction,
          false,
        );
        // Only start keeper when we have a valid acceptable price
        start(orderTimeAcceptablePriceRef.current);
      } else {
        // No price data available — fail the order rather than skip slippage check
        console.warn("[PaperGMX] No price data available, failing order");
        usePaperStore.getState().setOrderStatus("failed");
      }
    }
  }, [start, market, direction]);

  // Determine current step index
  const currentStepIndex = KEEPER_STEPS.findIndex((s) => s.key === orderStatus);

  // Can cancel during steps 0-2 (submitted, keeper_step_1, keeper_step_2)
  // Spec 5.4: "Cancel button during wait — Visible during steps 1-2"
  // State machine allows cancelled from submitted, keeper_step_1, keeper_step_2
  const canCancel =
    orderStatus === "submitted" ||
    orderStatus === "keeper_step_1" ||
    orderStatus === "keeper_step_2";

  const handleCancel = () => {
    cancel();
  };

  return (
    <div className="rounded-xl border border-border-primary bg-bg-card p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <span
          className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-bold ${
            isLong
              ? "bg-green-primary/20 text-green-primary"
              : "bg-red-primary/20 text-red-primary"
          }`}
        >
          {isLong ? "LONG" : "SHORT"}
        </span>
        <h3 className="mt-2 text-sm font-semibold text-text-primary">
          {isLong ? "Long" : "Short"} {marketConfig.symbol}
        </h3>
        <p className="text-xs text-text-muted">
          {marketConfig.pair} · {leverage}x · ${collateralUsd.toFixed(2)}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-0">
        {KEEPER_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex;

          return (
            <ProgressStep
              key={step.key}
              label={step.label}
              state={isDone ? "done" : isActive ? "active" : "pending"}
              isLast={index === KEEPER_STEPS.length - 1}
            />
          );
        })}
      </div>

      {/* Cancel button */}
      {canCancel && (
        <button
          onClick={handleCancel}
          className="w-full rounded-xl border border-border-primary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary"
        >
          Cancel Order
        </button>
      )}

      {/* Info text */}
      <p className="text-center text-[10px] text-text-muted leading-relaxed">
        Keeper execution simulated. Real GMX uses 2-8s weighted delays.
      </p>
    </div>
  );
}

// ─── Progress Step Sub-component ─────────────────────────

type StepState = "done" | "active" | "pending";

interface ProgressStepProps {
  label: string;
  state: StepState;
  isLast: boolean;
}

function ProgressStep({ label, state, isLast }: ProgressStepProps) {
  return (
    <div className="flex items-start gap-3">
      {/* Circle + connecting line */}
      <div className="flex flex-col items-center">
        {/* Circle */}
        <div
          className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
            state === "done"
              ? "border-green-primary bg-green-primary"
              : state === "active"
                ? "border-blue-primary bg-blue-primary/20"
                : "border-border-primary bg-transparent"
          }`}
        >
          {state === "done" && (
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={3}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4.5 12.75l6 6 9-13.5"
              />
            </svg>
          )}
          {state === "active" && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "easeInOut",
              }}
              className="h-2.5 w-2.5 rounded-full bg-blue-primary"
            />
          )}
        </div>

        {/* Connecting line */}
        {!isLast && (
          <div
            className={`w-0.5 h-6 transition-colors ${
              state === "done" ? "bg-green-primary" : "bg-border-primary"
            }`}
          />
        )}
      </div>

      {/* Label */}
      <span
        className={`text-xs leading-6 ${
          state === "done"
            ? "text-text-secondary line-through"
            : state === "active"
              ? "text-text-primary font-medium"
              : "text-text-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export const KeeperWaitScreen = memo(KeeperWaitScreenInner);
export default KeeperWaitScreen;
