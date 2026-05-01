"use client";

import { memo, useCallback, useState } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type { OrderDirection, MarketSlug, Position, USD } from "@/types";
import { usd } from "@/lib/branded";
import DirectionToggle from "./DirectionToggle";
import CollateralInput from "./CollateralInput";
import LeverageSlider from "./LeverageSlider";
import OrderSummary from "./OrderSummary";
import SubmitOrderButton from "./SubmitOrderButton";
import { useWalletSimulation } from "@/hooks/useWalletSimulation";
import { useLiquidationChecker } from "@/hooks/useLiquidationChecker";
import { useFeeAccrual } from "@/hooks/useFeeAccrual";
import { WalletOverlay } from "@/components/wallet/WalletOverlay";
import { WalletAnimator } from "@/components/wallet/WalletAnimator";
import { ApprovalPopup } from "@/components/wallet/ApprovalPopup";
import { SigningPopup } from "@/components/wallet/SigningPopup";
import { KeeperWaitScreen } from "@/components/keeper/KeeperWaitScreen";
import { OrderResultScreen } from "@/components/keeper/OrderResultScreen";
import { PositionCard } from "@/components/position/PositionCard";
import { ClosePositionForm } from "@/components/position/ClosePositionForm";
import { LiquidationScreen } from "@/components/position/LiquidationScreen";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";

// ─── Types ────────────────────────────────────────────────

export interface OrderEntryFormProps {
  market: MarketSlug;
}

// ─── Helper: is order in keeper phase? ────────────────────

function isKeeperPhase(status: string): boolean {
  return (
    status === "submitted" ||
    status === "keeper_step_1" ||
    status === "keeper_step_2" ||
    status === "keeper_step_3" ||
    status === "keeper_step_4"
  );
}

// ─── Component ────────────────────────────────────────────

function OrderEntryFormInner({ market }: OrderEntryFormProps) {
  // ─── Store subscriptions ────────────────────────────────
  const {
    balance,
    activePosition,
    orderStatus,
    prices,
    marketInfo,
    simulateKeeperDelay,
    approvedTokens,
    lockCollateral,
    setActivePosition,
    setOrderStatus,
    dismissOrderResult,
  } = usePaperStore(
    useShallow((s) => ({
      balance: s.balance,
      activePosition: s.activePosition,
      orderStatus: s.orderStatus,
      prices: s.prices,
      marketInfo: s.marketInfo,
      simulateKeeperDelay: s.simulateKeeperDelay,
      approvedTokens: s.approvedTokens,
      lockCollateral: s.lockCollateral,
      setActivePosition: s.setActivePosition,
      setOrderStatus: s.setOrderStatus,
      dismissOrderResult: s.dismissOrderResult,
    })),
  );

  // ─── Wallet simulation hook ─────────────────────────────
  const wallet = useWalletSimulation();

  // ─── Derived data ───────────────────────────────────────
  const priceData = prices[market];
  const info = marketInfo[market];
  const hasActivePosition = activePosition !== null;
  const needsApproval = !approvedTokens.includes("USDC");

  // ─── Liquidation checker (runs while position is active) ──
  // This hook runs side effects (auto-liquidation) — return value is for
  // consumers that need real-time liquidation status, but we don't use it
  // directly here since the LiquidationScreen is triggered via trade history.
  useLiquidationChecker(activePosition, prices);

  // ─── Fee accrual (runs while position is active) ─────────
  // Accrues borrow and funding fees every price update cycle.
  useFeeAccrual(activePosition, prices);

  // ─── Trade history for liquidation detection ─────────────
  const tradeHistory = usePaperStore(useShallow((s) => s.tradeHistory));

  // ─── Liquidation screen state ────────────────────────────
  // Track dismissed liquidation trade IDs so the screen doesn't re-show
  const [dismissedLiquidationIds, setDismissedLiquidationIds] = useState<
    Set<string>
  >(() => new Set());

  // Derive whether to show the LiquidationScreen from trade history
  const lastTrade = tradeHistory.length > 0 ? tradeHistory[0] : null;
  const recentLiquidation =
    !hasActivePosition &&
    lastTrade &&
    lastTrade.closeReason === "liquidated" &&
    !dismissedLiquidationIds.has(lastTrade.id)
      ? lastTrade
      : null;

  const handleLiquidationDismiss = useCallback(() => {
    if (lastTrade) {
      setDismissedLiquidationIds((prev) => {
        const next = new Set([...prev, lastTrade.id]);
        // Prune: only keep IDs that still exist in trade history to prevent
        // unbounded growth over many sessions.
        if (next.size > 20) {
          const historyIds = new Set(tradeHistory.slice(0, 20).map((t) => t.id));
          for (const id of next) {
            if (!historyIds.has(id)) next.delete(id);
          }
        }
        return next;
      });
    }
  }, [lastTrade, tradeHistory]);

  // ─── Local form state ───────────────────────────────────
  const [direction, setDirection] = useState<OrderDirection>("long");
  const [collateralUsd, setCollateralUsd] = useState<USD>(usd(0));
  const [leverage, setLeverage] = useState(5);

  // ─── Handlers ───────────────────────────────────────────
  const handleCollateralChange = useCallback((value: USD) => {
    setCollateralUsd(value);
  }, []);

  const handleLeverageChange = useCallback((value: number) => {
    setLeverage(value);
  }, []);

  const handleSubmit = useCallback(
    (position: Position) => {
      // Lock collateral (deduct from available balance)
      // GMX deducts full collateral when position opens.
      // Position fee is taken from collateral within the protocol.
      lockCollateral(position.collateralUsd);
      setActivePosition(position);
    },
    [lockCollateral, setActivePosition],
  );

  const handleStatusChange = useCallback(
    (status: import("@/types").OrderStatus) => {
      setOrderStatus(status);
    },
    [setOrderStatus],
  );

  const handleResultDismiss = useCallback(() => {
    dismissOrderResult(); // filled/failed/cancelled → idle, back to form
  }, [dismissOrderResult]);

  // ─── Show Liquidation Screen if position was just liquidated ──
  if (recentLiquidation) {
    return (
      <LiquidationScreen
        trade={recentLiquidation}
        prices={prices}
        onDismiss={handleLiquidationDismiss}
      />
    );
  }

  // ─── Already have a position — show Position Card + Close Form ──
  if (hasActivePosition) {
    return (
      <>
        <PositionCard
          position={activePosition}
          prices={prices}
          marketInfo={marketInfo}
        />
        <ClosePositionForm
          position={activePosition}
          prices={prices}
          marketInfo={marketInfo}
        />
      </>
    );
  }

  // ─── Keeper wait screen (replaces form during execution) ──
  if (isKeeperPhase(orderStatus)) {
    return (
      <KeeperWaitScreen
        direction={direction}
        collateralUsd={collateralUsd}
        leverage={leverage}
        market={market}
        orderStatus={orderStatus}
        simulateKeeperDelay={simulateKeeperDelay}
        onSubmit={handleSubmit}
      />
    );
  }

  // ─── Order result screen (filled/failed/cancelled) ────
  // filled = position opened successfully, user needs to dismiss to see PositionCard
  // failed/cancelled = order did not complete, user dismisses to retry
  if (orderStatus === "filled" || orderStatus === "failed" || orderStatus === "cancelled") {
    return (
      <OrderResultScreen
        resultType={orderStatus === "filled" ? "filled" : orderStatus === "failed" ? "failed" : "cancelled"}
        direction={direction}
        collateralUsd={collateralUsd}
        leverage={leverage}
        market={market}
        onDismiss={handleResultDismiss}
      />
    );
  }

  // ─── Form is disabled during wallet/approval/signing flow ───
  // At this point in the code, orderStatus is one of:
  // idle, failed, cancelled, approving, approved, signing, submitted, keeper_step_*, filled
  // The form should only be interactive when idle (or after early returns handled above)
  const formDisabled = orderStatus !== "idle";

  return (
    <>
      <div className="space-y-5">
        {/* Direction Toggle */}
        <TutorialTooltip
          tutorialKey="trade-form"
          title="Set up your trade"
          description="Choose Long (bet on price going up) or Short (bet on price going down). Then set your collateral amount and leverage. Higher leverage means bigger position size but also higher liquidation risk."
          position="left"
        >
          <div>
            <DirectionToggle
              direction={direction}
              onChange={setDirection}
              disabled={formDisabled}
            />

            {/* Collateral Input */}
            <CollateralInput
              value={collateralUsd}
              balance={balance}
              onChange={handleCollateralChange}
              disabled={formDisabled}
            />

            {/* Leverage Slider */}
            <LeverageSlider
              leverage={leverage}
              market={market}
              onChange={handleLeverageChange}
              disabled={formDisabled}
            />
          </div>
        </TutorialTooltip>

        {/* Separator */}
        <div className="h-px bg-border-primary" aria-hidden="true" />

        {/* Order Summary */}
        <OrderSummary
          direction={direction}
          collateralUsd={collateralUsd}
          leverage={leverage}
          market={market}
          priceData={priceData}
          marketInfo={info}
        />

        {/* Submit Button */}
        <TutorialTooltip
          tutorialKey="submit-order"
          title="Submit your order"
          description="This simulates the full GMX V2 trading flow: wallet approval (first time only) → order signing → keeper execution. No real crypto is used — it's all simulated! If you enable One-Click Trading, you can skip the approval popups."
          position="top"
        >
          <div>
            <SubmitOrderButton
              direction={direction}
              collateralUsd={collateralUsd}
              leverage={leverage}
              market={market}
              balance={balance}
              orderStatus={orderStatus}
              priceData={priceData}
              marketInfo={info}
              needsApproval={needsApproval}
              onStatusChange={handleStatusChange}
            />
          </div>
        </TutorialTooltip>
      </div>

      {/* ─── Wallet Popup Layer ──────────────────────────── */}
      <WalletOverlay visible={wallet.isVisible} />

      <WalletAnimator visible={wallet.isVisible}>
        {wallet.showApproval ? (
          <ApprovalPopup
            processing={wallet.processing}
            onApprove={wallet.handleApprove}
            onReject={wallet.handleRejectApproval}
          />
        ) : wallet.showSigning ? (
          <SigningPopup
            direction={direction}
            collateralUsd={collateralUsd}
            leverage={leverage}
            market={market}
            priceData={priceData}
            marketInfo={info}
            processing={wallet.processing}
            onConfirm={wallet.handleConfirm}
            onReject={wallet.handleRejectSigning}
          />
        ) : null}
      </WalletAnimator>
    </>
  );
}

export const OrderEntryForm = memo(OrderEntryFormInner);
export default OrderEntryForm;
