"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { usePositionPnl } from "@/hooks/usePositionPnl";
import type { Position, PriceData, MarketSlug, Price, Percent } from "@/types";
import { PRICE_POLL_INTERVAL } from "@/lib/constants";

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

  const { closePosition, setActivePosition } = usePaperStore(
    useShallow((s) => ({
      closePosition: s.closePosition,
      setActivePosition: s.setActivePosition,
    }))
  );

  // Ref to prevent double-liquidation
  const liquidationTriggered = useRef(false);

  // Refs to access latest values inside callbacks without re-subscribing
  const pnlRef = useRef(pnl);
  const positionRef = useRef(position);

  // Update refs in effects (not during render)
  useEffect(() => {
    pnlRef.current = pnl;
  }, [pnl]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  const triggerLiquidation = useCallback(() => {
    const pos = positionRef.current;
    const currentPnl = pnlRef.current;

    if (!pos || liquidationTriggered.current) return;

    // Use the current oracle worst price as exit price.
    // currentPrice is null when no price data is available — skip liquidation
    // entirely. We must NOT mark the position as "liquidated" before confirming
    // we have a valid price, otherwise the position gets stuck in a "liquidated"
    // state with no balance return and no trade history entry.
    if (!currentPnl.currentPrice) return;
    const exitPrice: Price = currentPnl.currentPrice;

    // Mark as triggered immediately to prevent race conditions
    liquidationTriggered.current = true;

    // Set position status to "liquidated" before closing
    setActivePosition({
      ...pos,
      status: "liquidated" as const,
    });

    // Close the position with liquidated reason
    // closePosition handles all P&L calculations and balance updates
    closePosition(exitPrice, "liquidated");
  }, [closePosition, setActivePosition]);

  useEffect(() => {
    // Reset trigger when position changes
    liquidationTriggered.current = false;
  }, [position?.id]);

  // Check for liquidation on every price update
  useEffect(() => {
    if (!position || position.status !== "active") return;

    // If position is already liquidatable and we haven't triggered yet
    if (pnl.isLiquidatable && !liquidationTriggered.current) {
      triggerLiquidation();
    }
  }, [position, pnl.isLiquidatable, triggerLiquidation]);

  // Also set up an interval check as a safety net (aligned with price updates)
  useEffect(() => {
    if (!position || position.status !== "active") return;

    const interval = setInterval(() => {
      const currentPnl = pnlRef.current;
      if (currentPnl.isLiquidatable && !liquidationTriggered.current) {
        triggerLiquidation();
      }
    }, PRICE_POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [position?.id, position?.status, triggerLiquidation]);

  return {
    isLiquidatable: pnl.isLiquidatable,
    liquidationReason: pnl.isLiquidatable ? "liquidated" as const : null,
    distanceToLiq: pnl.distanceToLiq,
  };
}
