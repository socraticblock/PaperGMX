"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import type { Position, PriceData, MarketSlug, Price, Percent } from "@/types";

// ─── Return type ─────────────────────────────────────────

export interface LiquidationCheckerResult {
  /** Whether the position is currently liquidatable */
  isLiquidatable: boolean;
  /** Close reason if liquidatable ("liquidated" or null) */
  liquidationReason: "liquidated" | null;
  /** Distance to liquidation as a percentage */
  distanceToLiq: Percent;
}

// ─── Hook ────────────────────────────────────────────────

/**
 * Continuously monitors an active position for liquidation conditions.
 * Runs on the same cadence as price updates (every 3 seconds).
 *
 * When the position becomes liquidatable:
 * 1. Sets position status to "liquidated"
 * 2. Calls closePosition(currentPrice, "liquidated")
 * 3. Triggers the LiquidationScreen display
 *
 * Returns liquidation status info for UI display.
 */
export function useLiquidationChecker(
  position: Position | null,
  prices: Record<MarketSlug, PriceData>
): LiquidationCheckerResult {
  const pnl = usePositionPnl(position, prices);

  const { closePosition } = usePaperStore(
    useShallow((s) => ({
      closePosition: s.closePosition,
    }))
  );

  // Ref to prevent double-liquidation
  const liquidationTriggered = useRef(false);

  // Refs to access latest values inside callbacks without re-subscribing.
  // Updated during render (not in effect) to avoid stale-value gaps between
  // the position changing and the effect running — same pattern as
  // useKeeperExecution.
  const pnlRef = useRef(pnl);
  // eslint-disable-next-line react-hooks/refs
  pnlRef.current = pnl;
  const positionRef = useRef(position);
  // eslint-disable-next-line react-hooks/refs
  positionRef.current = position;

  const triggerLiquidation = useCallback(() => {
    const pos = positionRef.current;
    const currentPnl = pnlRef.current;

    if (!pos || liquidationTriggered.current) return;

    // Don't liquidate if a close order is already in progress — prevents
    // a race where liquidation + manual close both call closePosition().
    // The manual close's "filled" result would overwrite the liquidation
    // reason, showing "Order Filled!" instead of the liquidation screen.
    const currentOrderStatus = usePaperStore.getState().orderStatus;
    if (currentOrderStatus !== "idle") return;

    // Use the current oracle worst price as exit price.
    // currentPrice is null when no price data is available — skip liquidation
    // entirely. We must NOT mark the position as "liquidated" before confirming
    // we have a valid price, otherwise the position gets stuck in a "liquidated"
    // state with no balance return and no trade history entry.
    if (!currentPnl.currentPrice) return;
    const exitPrice: Price = currentPnl.currentPrice;

    // Mark as triggered immediately to prevent race conditions
    liquidationTriggered.current = true;

    // Close the position with liquidated reason.
    // closePosition handles all P&L calculations and balance updates.
    // It sets activePosition: null and appends the trade to tradeHistory.
    // The redundant setActivePosition({...pos, status: "liquidated"}) was
    // previously called here, but it's dead code — closePosition immediately
    // sets activePosition to null, overwriting any status change.
    closePosition(exitPrice, "liquidated");

    // Transition orderStatus so the UI displays the liquidation result.
    // Without this, the position vanishes with zero visual feedback —
    // no order-result overlay, no LiquidationScreen.
    usePaperStore.getState().setOrderStatus("filled");
  }, [closePosition]);

  useEffect(() => {
    // Reset trigger when position changes
    liquidationTriggered.current = false;
  }, [position?.id]);

  // Check for liquidation on every price update (useEffect fires on every
  // pnl.isLiquidatable change, which updates with every price tick).
  // The previous redundant setInterval was removed — the effect alone
  // catches every change, and the liquidationTriggered ref prevents doubles.
  useEffect(() => {
    if (!position || position.status !== "active") return;

    if (pnl.isLiquidatable && !liquidationTriggered.current) {
      triggerLiquidation();
    }
  }, [position, pnl.isLiquidatable, triggerLiquidation]);

  return {
    isLiquidatable: pnl.isLiquidatable,
    liquidationReason: pnl.isLiquidatable ? "liquidated" as const : null,
    distanceToLiq: pnl.distanceToLiq,
  };
}
