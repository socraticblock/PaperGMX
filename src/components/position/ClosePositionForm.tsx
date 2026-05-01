"use client";

import { memo, useCallback, useRef, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import type {
  Position,
  OrderStatus,
  MarketSlug,
  PriceData,
  MarketInfo,
  ClosedTrade,
  Price,
} from "@/types";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { useCloseKeeper } from "@/hooks/useCloseKeeper";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import { useWalletSimulation } from "@/hooks/useWalletSimulation";
import {
  calculateAcceptablePrice,
  calculateClosePosition,
  determineFillPrice,
} from "@/lib/calculations";
import { formatUSD, formatPrice } from "@/lib/format";
import { MARKETS, SLIPPAGE_CLOSE_BPS } from "@/lib/constants";
import { WalletOverlay } from "@/components/wallet/WalletOverlay";
import { WalletAnimator } from "@/components/wallet/WalletAnimator";

// ─── Props ───────────────────────────────────────────────

export interface ClosePositionFormProps {
  position: Position;
  prices: Record<MarketSlug, PriceData>;
  marketInfo: Record<MarketSlug, MarketInfo>;
}

// ─── Close Keeper Steps ─────────────────────────────────

const CLOSE_KEEPER_STEPS = [
  { key: "submitted", label: "Close Order Submitted" },
  { key: "keeper_step_1", label: "Oracle Confirming Price" },
  { key: "keeper_step_2", label: "Keeper Executing" },
  { key: "keeper_step_3", label: "Position Closing" },
  { key: "keeper_step_4", label: "Position Closed" },
] as const;

// ─── Helper ──────────────────────────────────────────────

function isKeeperPhase(status: string): boolean {
  return (
    status === "submitted" ||
    status === "keeper_step_1" ||
    status === "keeper_step_2" ||
    status === "keeper_step_3" ||
    status === "keeper_step_4"
  );
}

// ─── Component ───────────────────────────────────────────

function ClosePositionFormInner({ position, prices, marketInfo }: ClosePositionFormProps) {
  const marketConfig = MARKETS[position.market];
  const pnl = usePositionPnl(position, prices, marketInfo);

  // ─── Store ─────────────────────────────────────────────
  const {
    orderStatus,
    simulateKeeperDelay,
    tradingMode,
    oneClickTrading,
    setOrderStatus,
    dismissOrderResult,
    decrementOneClickActions,
  } = usePaperStore(
    useShallow((s) => ({
      orderStatus: s.orderStatus,
      simulateKeeperDelay: s.simulateKeeperDelay,
      tradingMode: s.tradingMode,
      oneClickTrading: s.oneClickTrading,
      setOrderStatus: s.setOrderStatus,
      dismissOrderResult: s.dismissOrderResult,
      decrementOneClickActions: s.decrementOneClickActions,
    }))
  );

  // ─── Close reason (selected by user) ───────────────────
  const [selectedReason, setSelectedReason] = useState<ClosedTrade["closeReason"]>("take_profit");
  const is1ctMode = tradingMode === "1ct" && oneClickTrading.enabled;

  // ─── Close keeper ──────────────────────────────────────
  const closeKeeper = useCloseKeeper(
    position.market,
    position.direction,
    selectedReason, // Dynamic — ref updates on re-render
    simulateKeeperDelay
  );

  // ─── Wallet simulation ─────────────────────────────────
  const wallet = useWalletSimulation();

  // ─── Estimate close values ─────────────────────────────
  const closeEstimate = useMemo(() => {
    if (!pnl.currentPrice || pnl.currentPrice <= 0) return null;

    const priceData = prices[position.market];
    if (!priceData) return null;

    const estFillPrice = determineFillPrice(
      priceData.min,
      priceData.max,
      position.direction,
      true
    );

    const acceptablePrice = calculateAcceptablePrice(
      estFillPrice,
      SLIPPAGE_CLOSE_BPS,
      position.direction,
      true
    );

    const closeResult = calculateClosePosition(
      position.direction,
      position.entryPrice,
      estFillPrice,
      position.sizeUsd,
      position.collateralUsd,
      position.positionFeePaid,
      position.positionFeeBps,
      position.borrowFeeAccrued,
      position.fundingFeeAccrued
    );

    return {
      estFillPrice,
      acceptablePrice,
      ...closeResult,
    };
  }, [pnl.currentPrice, prices, position]);

  // ─── Start keeper when order becomes "submitted" ────────
  const startedRef = useRef(false);

  useEffect(() => {
    if (orderStatus === "submitted" && !startedRef.current) {
      const currentPriceData = usePaperStore.getState().prices[position.market];
      if (currentPriceData && currentPriceData.last > 0) {
        startedRef.current = true;
        const fillPrice = determineFillPrice(
          currentPriceData.min,
          currentPriceData.max,
          position.direction,
          true
        );
        const acceptablePrice = calculateAcceptablePrice(
          fillPrice,
          SLIPPAGE_CLOSE_BPS,
          position.direction,
          true
        );

        closeKeeper.start(acceptablePrice);
      } else {
        console.warn("[PaperGMX] No price data available, failing close order");
        usePaperStore.getState().setOrderStatus("failed");
      }
    }

    // Reset started ref when flow resets
    if (orderStatus === "idle" || orderStatus === "failed" || orderStatus === "cancelled") {
      startedRef.current = false;
    }
  }, [orderStatus, position.market, position.direction, closeKeeper]);

  // ─── Handlers ──────────────────────────────────────────
  const handleClose = useCallback(
    (reason: ClosedTrade["closeReason"]) => {
      setSelectedReason(reason);
      if (is1ctMode) {
        // 1CT skips wallet signing entirely. Go straight to submitted.
        // NOTE: We do NOT decrement the 1CT action quota here — the quota
        // should only burn when the close actually succeeds. A useEffect
        // below handles the decrement when orderStatus reaches "filled".
        setOrderStatus("submitted");
        return;
      }

      // Classic close doesn't require token approval — only signing.
      setOrderStatus("signing");
    },
    [is1ctMode, setOrderStatus]
  );

  // Decrement 1CT action quota only after a successful close.
  // This mirrors the same pattern used in SubmitOrderButton — the quota
  // should only burn when the order actually fills, not on button click,
  // so that failed/cancelled orders don't waste the action budget.
  useEffect(() => {
    if (orderStatus === "filled" && is1ctMode) {
      decrementOneClickActions();
    }
  }, [orderStatus, is1ctMode, decrementOneClickActions]);

  const handleResultDismiss = useCallback(() => {
    dismissOrderResult(); // filled/failed/cancelled → idle
  }, [dismissOrderResult]);

  // ─── Keeper Wait Screen ────────────────────────────────
  if (isKeeperPhase(orderStatus)) {
    return (
      <CloseKeeperWaitScreen
        position={position}
        orderStatus={orderStatus}
        closeKeeper={closeKeeper}
      />
    );
  }

  // ─── Order result screen (filled/failed/cancelled) ────
  // filled = position closed successfully, dismiss returns to trade form
  // failed/cancelled = close did not complete, dismiss returns to position
  if (orderStatus === "filled" || orderStatus === "failed" || orderStatus === "cancelled") {
    return (
      <OrderResultScreen
        resultType={orderStatus === "filled" ? "filled" : orderStatus === "failed" ? "failed" : "cancelled"}
        direction={position.direction}
        collateralUsd={position.collateralUsd}
        leverage={position.leverage}
        market={position.market}
        onDismiss={handleResultDismiss}
      />
    );
  }

  // ─── Main Close Form ───────────────────────────────────
  const formDisabled = orderStatus !== "idle";
  const pnlIsPositive = pnl.netPnl >= 0;

  return (
    <>
      <div className="space-y-4">
        {/* Separator */}
        <div className="h-px bg-border-primary" aria-hidden="true" />

        {/* Close Position Header */}
        <div>
          <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">
            Close Position
          </h3>
          <p className="text-[10px] text-text-muted mt-0.5">
            Market decrease order · 3% max slippage
          </p>
        </div>

        {/* Close Order Summary */}
        {closeEstimate && (
          <div className="rounded-lg bg-bg-input px-3 py-2.5 space-y-1">
            <CloseSummaryRow
              label="Est. Exit Price"
              value={`$${formatPrice(closeEstimate.estFillPrice, marketConfig.decimals)}`}
            />
            <CloseSummaryRow
              label="Acceptable Price"
              value={`$${formatPrice(closeEstimate.acceptablePrice, marketConfig.decimals)}`}
              tooltip="Max slippage: 3% from exit"
            />
            <CloseSummaryRow
              label="Close Fee"
              value={formatUSD(closeEstimate.positionFeeClose)}
            />
            <CloseSummaryRow
              label="Est. Return"
              value={formatUSD(closeEstimate.returnedCollateral)}
              valueColor={pnlIsPositive ? "text-green-primary" : "text-red-primary"}
            />
            <CloseSummaryRow
              label="Est. Net P&amp;L"
              value={formatUSD(closeEstimate.netPnl)}
              valueColor={pnlIsPositive ? "text-green-primary" : "text-red-primary"}
            />
          </div>
        )}

        {/* Two Close Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => handleClose("take_profit")}
            disabled={formDisabled}
            className="rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none bg-green-primary"
          >
            Take Profit
          </button>
          <button
            onClick={() => handleClose("cut_loss")}
            disabled={formDisabled}
            className="rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none bg-red-primary"
          >
            Cut Loss
          </button>
        </div>

        {/* Note */}
        <p className="text-[10px] text-text-muted text-center leading-relaxed">
          &quot;Take Profit&quot; and &quot;Cut Loss&quot; only differ in your trade history label.
          Both execute a market decrease order at the current oracle price.
        </p>
      </div>

      {/* ─── Wallet Popup Layer ──────────────────────────── */}
      <WalletOverlay visible={wallet.isVisible} />

      <WalletAnimator visible={wallet.isVisible}>
        {wallet.showSigning ? (
          <CloseSigningPopup
            position={position}
            closeEstimate={closeEstimate}
            processing={wallet.processing}
            onConfirm={wallet.handleConfirm}
            onReject={wallet.handleRejectSigning}
          />
        ) : null}
      </WalletAnimator>
    </>
  );
}

// ─── Close Summary Row ──────────────────────────────────

interface CloseSummaryRowProps {
  label: string;
  value: string;
  valueColor?: string;
  tooltip?: string;
}

function CloseSummaryRow({ label, value, valueColor, tooltip }: CloseSummaryRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <span className="text-[11px] text-text-muted">{label}</span>
        {tooltip && (
          <span title={tooltip} className="cursor-help">
            <span className="text-[9px] text-text-muted/60">ⓘ</span>
          </span>
        )}
      </div>
      <span className={`text-[11px] font-mono font-medium ${valueColor ?? "text-text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

// ─── Close Signing Popup ────────────────────────────────

interface CloseSigningPopupProps {
  position: Position;
  closeEstimate: {
    estFillPrice: Price;
    acceptablePrice: Price;
    positionFeeClose: import("@/types").USD;
    netPnl: import("@/types").USD;
    returnedCollateral: import("@/types").USD;
  } | null;
  processing: import("@/hooks/useWalletSimulation").PopupProcessingState;
  onConfirm: () => void;
  onReject: () => void;
}

function CloseSigningPopup({
  position,
  closeEstimate,
  processing,
  onConfirm,
  onReject,
}: CloseSigningPopupProps) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";
  const isIdle = processing === "idle";
  const isProcessing = processing === "processing";
  const isSuccess = processing === "success";

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-primary/20">
          <svg
            className="h-4 w-4 text-blue-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Confirm Close Position
          </h2>
          <p className="text-xs text-text-muted">Market Decrease Order</p>
        </div>
        <div className="ml-auto">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
              isLong
                ? "bg-green-primary/20 text-green-primary"
                : "bg-red-primary/20 text-red-primary"
            }`}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-3">
        <PopupDetailRow label="Market" value={marketConfig.pair} />
        <PopupDetailRow label="Position Size" value={formatUSD(position.sizeUsd)} highlight />
        <PopupDetailRow
          label="Est. Exit Price"
          value={
            closeEstimate
              ? `$${formatPrice(closeEstimate.estFillPrice, marketConfig.decimals)}`
              : "—"
          }
        />
        <PopupDetailRow
          label="Acceptable Price"
          value={
            closeEstimate
              ? `$${formatPrice(closeEstimate.acceptablePrice, marketConfig.decimals)}`
              : "—"
          }
          tooltip="Max slippage: 3%"
        />
        <PopupDetailRow
          label="Close Fee"
          value={closeEstimate ? formatUSD(closeEstimate.positionFeeClose) : "—"}
        />
        <PopupDetailRow
          label="Est. Net P&amp;L"
          value={closeEstimate ? formatUSD(closeEstimate.netPnl) : "—"}
          highlight
        />
        <PopupDetailRow label="Est. Gas" value="~$0.65" />
      </div>

      {/* Disclaimer */}
      <div className="mx-5 mb-4 rounded-lg bg-bg-input px-3 py-2">
        <p className="text-[10px] text-text-muted leading-relaxed text-center">
          Paper trading simulation. Same fees &amp; pricing as GMX V2, zero real risk.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 px-5 pb-5">
        {isIdle && (
          <>
            <button
              onClick={onReject}
              className="flex-1 rounded-xl border border-border-primary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-input"
            >
              Reject
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 rounded-xl bg-blue-primary py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Confirm Close
            </button>
          </>
        )}

        {isProcessing && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-primary/20 py-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current text-blue-primary" />
            <span className="text-sm font-medium text-blue-primary">
              Submitting...
            </span>
          </div>
        )}

        {isSuccess && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-primary/20 py-3">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="text-lg text-green-primary"
              aria-hidden="true"
            >
              ✓
            </motion.span>
            <span className="text-sm font-bold text-green-primary">
              Confirmed!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Popup Detail Row ───────────────────────────────────

interface PopupDetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  tooltip?: string;
}

function PopupDetailRow({ label, value, highlight, tooltip }: PopupDetailRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">
        {label}
        {tooltip && (
          <span title={tooltip} className="ml-1 cursor-help opacity-60">
            ⓘ
          </span>
        )}
      </span>
      <span
        className={`text-xs font-mono ${
          highlight ? "text-text-primary font-semibold" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

// ─── Close Keeper Wait Screen ───────────────────────────

interface CloseKeeperWaitScreenProps {
  position: Position;
  orderStatus: OrderStatus;
  closeKeeper: ReturnType<typeof useCloseKeeper>;
}

function CloseKeeperWaitScreen({
  position,
  orderStatus,
  closeKeeper,
}: CloseKeeperWaitScreenProps) {
  const marketConfig = MARKETS[position.market];
  const isLong = position.direction === "long";

  const currentStepIndex = CLOSE_KEEPER_STEPS.findIndex(
    (s) => s.key === orderStatus
  );

  const canCancel =
    orderStatus === "submitted" ||
    orderStatus === "keeper_step_1" ||
    orderStatus === "keeper_step_2";

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
          CLOSING {isLong ? "LONG" : "SHORT"}
        </span>
        <h3 className="mt-2 text-sm font-semibold text-text-primary">
          Close {marketConfig.symbol} Position
        </h3>
        <p className="text-xs text-text-muted">
          {marketConfig.pair} · {position.leverage}x · ${position.collateralUsd.toFixed(2)}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="space-y-0">
        {CLOSE_KEEPER_STEPS.map((step, index) => {
          const isActive = index === currentStepIndex;
          const isDone = index < currentStepIndex;

          return (
            <ProgressStep
              key={step.key}
              label={step.label}
              state={isDone ? "done" : isActive ? "active" : "pending"}
              isLast={index === CLOSE_KEEPER_STEPS.length - 1}
            />
          );
        })}
      </div>

      {/* Cancel button */}
      {canCancel && (
        <button
          onClick={() => closeKeeper.cancel()}
          className="w-full rounded-xl border border-border-primary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-input hover:text-text-primary"
        >
          Cancel Close
        </button>
      )}

      {/* Info text */}
      <p className="text-center text-[10px] text-text-muted leading-relaxed">
        Keeper execution simulated. Real GMX uses 2-8s weighted delays.
      </p>
    </div>
  );
}

// ─── Order Result Screen ────────────────────────────────

interface OrderResultScreenProps {
  resultType: "filled" | "failed" | "cancelled";
  direction: import("@/types").OrderDirection;
  collateralUsd: import("@/types").USD;
  leverage: number;
  market: MarketSlug;
  onDismiss: () => void;
}

function OrderResultScreen({
  resultType,
  direction,
  collateralUsd,
  leverage,
  market,
  onDismiss,
}: OrderResultScreenProps) {
  const marketConfig = MARKETS[market];
  const isFilled = resultType === "filled";
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
            isFilled ? "bg-green-primary/20" : isFailed ? "bg-red-primary/20" : "bg-yellow-primary/20"
          }`}
        >
          {isFilled ? (
            <svg className="h-6 w-6 text-green-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : isFailed ? (
            <svg className="h-6 w-6 text-red-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          ) : (
            <svg className="h-6 w-6 text-yellow-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          )}
        </motion.div>

        <h3 className="mt-3 text-sm font-semibold text-text-primary">
          {isFilled ? "Position Closed" : isFailed ? "Close Failed" : "Close Cancelled"}
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          {isFilled
            ? "Your position has been closed successfully."
            : isFailed
            ? "Price moved past your acceptable price. Position is still open."
            : "Your close order was cancelled. Position is still open."}
        </p>
      </div>

      {/* Order details */}
      <div className="rounded-lg bg-bg-input px-4 py-3 space-y-2">
        <ResultDetailRow label="Market" value={marketConfig.pair} />
        <ResultDetailRow label="Direction" value={direction === "long" ? "Long" : "Short"} />
        <ResultDetailRow label="Collateral" value={`$${collateralUsd.toFixed(2)}`} />
        <ResultDetailRow label="Leverage" value={`${leverage}x`} />
      </div>

      {/* Dismiss button */}
      <button
        onClick={onDismiss}
        className={`w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] ${
          isFilled ? "bg-green-primary" : "bg-blue-primary"
        }`}
      >
        {isFilled ? "Done" : "Back to Position"}
      </button>
    </div>
  );
}

function ResultDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className="text-xs font-mono text-text-secondary">{value}</span>
    </div>
  );
}

// ─── Progress Step ──────────────────────────────────────

type StepState = "done" | "active" | "pending";

interface ProgressStepProps {
  label: string;
  state: StepState;
  isLast: boolean;
}

function ProgressStep({ label, state, isLast }: ProgressStepProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
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
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          )}
          {state === "active" && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
              className="h-2.5 w-2.5 rounded-full bg-blue-primary"
            />
          )}
        </div>

        {!isLast && (
          <div
            className={`w-0.5 h-6 transition-colors ${
              state === "done" ? "bg-green-primary" : "bg-border-primary"
            }`}
          />
        )}
      </div>

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

export const ClosePositionForm = memo(ClosePositionFormInner);
export default ClosePositionForm;
