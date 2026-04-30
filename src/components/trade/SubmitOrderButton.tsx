"use client";

import { memo, useCallback } from "react";
import type { OrderDirection, OrderStatus, USD, MarketSlug, PriceData, MarketInfo } from "@/types";
import { formatUSD } from "@/lib/format";
import { calculatePositionSize } from "@/lib/calculations";
import { MARKETS } from "@/lib/constants";
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
  onStatusChange: (status: OrderStatus) => void;
}

// ─── Component ────────────────────────────────────────────
// Phase 5: This button ONLY triggers the wallet flow.
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
  marketInfo,
  needsApproval,
  onStatusChange,
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

  // ─── Button click: start the wallet flow ────────────────
  const handleClick = useCallback(() => {
    if (!canSubmit) return;

    if (needsApproval) {
      onStatusChange("approving"); // Triggers ApprovalPopup
    } else {
      onStatusChange("signing"); // Skip approval, go to signing
    }
  }, [canSubmit, needsApproval, onStatusChange]);

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
      // Keeper states are handled by KeeperWaitScreen, not this button.
      // But we still need fallback states in case the button is visible.
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
