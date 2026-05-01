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
import { WalletOverlay } from "@/components/wallet/WalletOverlay";
import { WalletAnimator } from "@/components/wallet/WalletAnimator";
import { ApprovalPopup } from "@/components/wallet/ApprovalPopup";
import { SigningPopup } from "@/components/wallet/SigningPopup";
import { KeeperWaitScreen } from "@/components/keeper/KeeperWaitScreen";
import { OrderResultScreen } from "@/components/keeper/OrderResultScreen";
import { PositionCard } from "@/components/position/PositionCard";
import { ClosePositionForm } from "@/components/position/ClosePositionForm";

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
    }))
  );

  // ─── Wallet simulation hook ─────────────────────────────
  const wallet = useWalletSimulation();

  // ─── Local form state ───────────────────────────────────
  const [direction, setDirection] = useState<OrderDirection>("long");
  const [collateralUsd, setCollateralUsd] = useState<USD>(usd(0));
  const [leverage, setLeverage] = useState(5);

  // ─── Derived data ───────────────────────────────────────
  const priceData = prices[market];
  const info = marketInfo[market];
  const hasActivePosition = activePosition !== null;
  const needsApproval = !approvedTokens.includes("USDC");

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
    [lockCollateral, setActivePosition]
  );

  const handleStatusChange = useCallback(
    (status: import("@/types").OrderStatus) => {
      setOrderStatus(status);
    },
    [setOrderStatus]
  );

  const handleResultDismiss = useCallback(() => {
    setOrderStatus("idle"); // failed/cancelled → idle, back to form
  }, [setOrderStatus]);

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

  // ─── Order result screen (failed/cancelled) ────────────
  if (orderStatus === "failed" || orderStatus === "cancelled") {
    return (
      <OrderResultScreen
        resultType={orderStatus === "failed" ? "failed" : "cancelled"}
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
