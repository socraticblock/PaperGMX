"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type {
  EntryOrderType,
  OrderDirection,
  OrderStatus,
  USD,
  MarketSlug,
  PriceData,
  ApiConnectionStatus,
} from "@/types";
import { formatUSD } from "@/lib/format";
import { calculatePositionSize } from "@/lib/calculations";
import {
  MARKETS,
  ONE_CLICK_MAX_ACTIONS,
  ONE_CLICK_WARNING_THRESHOLD,
} from "@/lib/constants";
import { motion, AnimatePresence } from "framer-motion";
import { BoltIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface SubmitOrderButtonProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  balance: USD;
  orderStatus: OrderStatus;
  priceData: PriceData | undefined;
  connectionStatus: ApiConnectionStatus;
  /** Limit entry shows preview only — submission stays disabled. */
  entryOrderType?: EntryOrderType;
  /**
   * Override for the primary action verb shown when the button is in the idle
   * "ready to submit" state. Defaults to "Long X" / "Short X". Used to swap
   * to "Increase Long X" when an existing position would be increased.
   */
  actionLabel?: string;
  onStatusChange: (status: OrderStatus) => void;
}

// ─── Component ────────────────────────────────────────────
// Phase 5 + Phase 10: This button triggers the wallet flow.
// In 1CT mode, it skips wallet popups and submits directly.
// Keeper execution is handled by useKeeperExecution hook
// (used by KeeperWaitScreen), not here.

function SubmitOrderButtonInner({
  direction,
  collateralUsd,
  leverage,
  market,
  balance,
  orderStatus,
  priceData,
  connectionStatus,
  entryOrderType = "market",
  actionLabel,
  onStatusChange,
}: SubmitOrderButtonProps) {
  const { oneClickTrading, tradingMode } =
    usePaperStore(
      useShallow((s) => ({
        oneClickTrading: s.oneClickTrading,
        tradingMode: s.tradingMode,
      })),
    );

  const marketConfig = MARKETS[market];
  const sizeUsd = calculatePositionSize(collateralUsd, leverage);
  const isLong = direction === "long";

  // ─── 1CT State ──────────────────────────────────────
  const is1ctMode = tradingMode === "1ct" && oneClickTrading.enabled;
  // Track current time in state to avoid calling Date.now() during render
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);
  const isExpired =
    oneClickTrading.expiresAt !== null &&
    oneClickTrading.expiresAt < now;
  const isDepleted = oneClickTrading.actionsRemaining <= 0;
  const needsRenewal = is1ctMode && (isExpired || isDepleted);
  const isLow1ct =
    is1ctMode &&
    oneClickTrading.actionsRemaining <= ONE_CLICK_WARNING_THRESHOLD;

  // ─── Validation ─────────────────────────────────────────
  const hasPriceData = priceData && priceData.last > 0;
  /** PaperGMX uses only the GMX oracle API — no alternate venue when it is down */
  const isGmxOracleDown = connectionStatus === "disconnected";
  const insufficientBalance = collateralUsd > balance;
  const belowMinimum = collateralUsd < 1;
  const canSubmit =
    entryOrderType === "market" &&
    hasPriceData &&
    !isGmxOracleDown &&
    !insufficientBalance &&
    !belowMinimum &&
    collateralUsd > 0 &&
    (orderStatus === "idle" || orderStatus === "failed" || orderStatus === "cancelled") &&
    !needsRenewal; // Can't submit if 1CT needs renewal

  // ─── Button click: start the wallet flow ────────────────
  const handleClick = useCallback(() => {
    if (!canSubmit) return;

    // In 1CT mode: skip approval entirely, go straight to signing
    // In classic mode: show approval popup if needed
    onStatusChange("submitted");
  }, [
    canSubmit,
    onStatusChange,
  ]);

  // 1CT action quota is now decremented in the store's setOrderStatus
  // when transitioning to "filled" — not in this component's useEffect.
  // Previously, this component used a useEffect to decrement, but it could
  // unmount before the order fills (replaced by KeeperWaitScreen), causing
  // the decrement to be missed. The store-level decrement is reliable.

  // ─── Button state config ────────────────────────────────
  const buttonConfig = (() => {
    switch (orderStatus) {
      case "approving":
      case "approved":
      case "signing":
        return {
          text: "Submitting order...",
          bgClass: "bg-blue-primary",
          showSpinner: true,
        };
      // Keeper states are handled by KeeperWaitScreen, not this button.
      // Keeper states if this button is still visible during an edge transition.
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
        if (collateralUsd <= 0) {
          return {
            text: "Enter an amount",
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
        if (entryOrderType === "limit") {
          return {
            text: "Limit execution not simulated",
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
        if (isGmxOracleDown) {
          return {
            text: "Waiting for GMX oracle…",
            bgClass: "bg-yellow-primary cursor-not-allowed",
            showSpinner: false,
          };
        }
        // 1CT renewal needed
        if (needsRenewal) {
          return {
            text: isExpired ? "1CT Expired — Renew" : "1CT Depleted — Renew",
            bgClass: "bg-yellow-primary",
            showSpinner: false,
          };
        }
        // Normal submit text — include ⚡ badge for 1CT.
        // actionLabel overrides the verb (e.g. "Increase Long ETH").
        const verb =
          actionLabel ?? `${isLong ? "Long" : "Short"} ${marketConfig.symbol}`;
        if (is1ctMode) {
          return {
            text: `${verb} ⚡ — ${formatUSD(sizeUsd)}`,
            bgClass: isLong ? "bg-green-primary" : "bg-red-primary",
            showSpinner: false,
          };
        }
        return {
          text: `${verb} — ${formatUSD(sizeUsd)}`,
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
          canSubmit
            ? "hover:brightness-110 active:brightness-90"
            : "cursor-not-allowed"
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
      <div className="mt-2 text-center text-[10px] text-text-muted leading-relaxed">
        <p>
          Paper trading only — no real funds at risk.
          <br />
          Position fee: 4-6 BPS (based on pool balance). Keeper execution
          simulated.
        </p>
        {is1ctMode && (
          <p
            className={`mt-1 ${isLow1ct ? "text-yellow-primary" : "text-purple-primary"}`}
          >
            <BoltIcon className="inline h-3 w-3" aria-hidden="true" /> 1CT:{" "}
            {oneClickTrading.actionsRemaining}/{ONE_CLICK_MAX_ACTIONS} actions
            remaining
          </p>
        )}
      </div>
    </div>
  );
}

export const SubmitOrderButton = memo(SubmitOrderButtonInner);
export default SubmitOrderButton;
