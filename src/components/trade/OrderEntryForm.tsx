"use client";

import { memo, useCallback, useState } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type { OrderDirection, MarketSlug, Position, USD } from "@/types";
import { usd } from "@/lib/branded";
import { calculateLiquidationPrice } from "@/lib/calculations";
import { MARKETS } from "@/lib/constants";
import DirectionToggle from "./DirectionToggle";
import CollateralInput from "./CollateralInput";
import LeverageSlider from "./LeverageSlider";
import OrderSummary from "./OrderSummary";
import SubmitOrderButton from "./SubmitOrderButton";

// ─── Types ────────────────────────────────────────────────

export interface OrderEntryFormProps {
  market: MarketSlug;
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
      setActivePosition: s.setActivePosition,
      setOrderStatus: s.setOrderStatus,
    }))
  );

  // ─── Local form state ───────────────────────────────────
  const [direction, setDirection] = useState<OrderDirection>("long");
  const [collateralUsd, setCollateralUsd] = useState<USD>(usd(0));
  const [leverage, setLeverage] = useState(5);

  // ─── Derived data ───────────────────────────────────────
  const marketConfig = MARKETS[market];
  const priceData = prices[market];
  const info = marketInfo[market];
  const hasActivePosition = activePosition !== null;

  // ─── Handlers ───────────────────────────────────────────
  const handleCollateralChange = useCallback((value: USD) => {
    setCollateralUsd(value);
  }, []);

  const handleLeverageChange = useCallback((value: number) => {
    setLeverage(value);
  }, []);

  const handleSubmit = useCallback(
    (position: Position) => {
      // Calculate liquidation price and store position
      const liqPrice = calculateLiquidationPrice(
        position.direction,
        position.entryPrice,
        position.collateralUsd,
        position.sizeUsd,
        marketConfig.maintenanceMarginBps,
        usd(0) // No accrued fees at open
      );

      setActivePosition({
        ...position,
        liquidationPrice: liqPrice,
      });
    },
    [marketConfig.maintenanceMarginBps, setActivePosition]
  );

  const handleStatusChange = useCallback(
    (status: import("@/types").OrderStatus) => {
      setOrderStatus(status);
    },
    [setOrderStatus]
  );

  // ─── Already have a position ────────────────────────────
  if (hasActivePosition) {
    return (
      <div className="rounded-xl border border-yellow-primary/30 bg-yellow-bg p-6 text-center">
        <p className="text-sm font-medium text-yellow-primary">
          You already have an active position on {MARKETS[activePosition.market].pair}
        </p>
        <p className="mt-1 text-xs text-text-muted">
          Close your current position before opening a new one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Direction Toggle */}
      <DirectionToggle
        direction={direction}
        onChange={setDirection}
        disabled={orderStatus !== "idle" && orderStatus !== "failed"}
      />

      {/* Collateral Input */}
      <CollateralInput
        value={collateralUsd}
        balance={balance}
        onChange={handleCollateralChange}
        disabled={orderStatus !== "idle" && orderStatus !== "failed"}
      />

      {/* Leverage Slider */}
      <LeverageSlider
        leverage={leverage}
        market={market}
        onChange={handleLeverageChange}
        disabled={orderStatus !== "idle" && orderStatus !== "failed"}
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
        onSubmit={handleSubmit}
        onStatusChange={handleStatusChange}
        simulateKeeperDelay={simulateKeeperDelay}
      />
    </div>
  );
}

export const OrderEntryForm = memo(OrderEntryFormInner);
export default OrderEntryForm;
