"use client";

import { useRef, useCallback, useEffect } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import type { OrderStatus, OrderDirection, Price, MarketSlug, ClosedTrade } from "@/types";
import { ORDER_TRANSITIONS } from "@/types";
import { determineFillPrice } from "@/lib/calculations";
import { KEEPER_TIMING_WEIGHTS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────

export interface CloseKeeperResult {
  /** Start the keeper execution for closing. */
  start: (orderTimeAcceptablePrice: Price) => void;
  /** Cancel the keeper execution (only valid during steps 1-2). */
  cancel: () => void;
}

// ─── Keeper delay sampling ───────────────────────────────

function sampleKeeperDelay(): number {
  const totalWeight = KEEPER_TIMING_WEIGHTS.reduce((sum, d) => sum + d.weight, 0);
  let random = Math.random() * totalWeight;
  for (const delay of KEEPER_TIMING_WEIGHTS) {
    random -= delay.weight;
    if (random <= 0) return delay.seconds * 1000;
  }
  return 3000;
}

// ─── Hook ────────────────────────────────────────────────
//
// Manages the keeper execution for closing a position.
// Follows the same pattern as useKeeperExecution but:
// - Uses "market_decrease" order type
// - Uses 300 BPS slippage for closes (vs 50 BPS for opens)
// - Calls closePosition() on the store
// - Gets fill price at execution time for close direction

export function useCloseKeeper(
  market: MarketSlug,
  direction: OrderDirection,
  closeReason: ClosedTrade["closeReason"],
  simulateKeeperDelay: boolean,
): CloseKeeperResult {
  // ─── Store subscriptions ─────────────────────────────────
  const setOrderStatus = usePaperStore((s) => s.setOrderStatus);
  const closePosition = usePaperStore((s) => s.closePosition);

  // ─── Refs for latest values (avoid stale closures) ───────
  const marketRef = useRef(market);
  const directionRef = useRef(direction);
  const closeReasonRef = useRef(closeReason);
  const simulateKeeperDelayRef = useRef(simulateKeeperDelay);
  const setOrderStatusRef = useRef(setOrderStatus);
  const closePositionRef = useRef(closePosition);

  // Update refs in useEffect to comply with React purity rules
  useEffect(() => {
    marketRef.current = market;
    directionRef.current = direction;
    closeReasonRef.current = closeReason;
    simulateKeeperDelayRef.current = simulateKeeperDelay;
    setOrderStatusRef.current = setOrderStatus;
    closePositionRef.current = closePosition;
  }, [market, direction, closeReason, simulateKeeperDelay, setOrderStatus, closePosition]);

  // ─── Cancellation ref ────────────────────────────────────
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const orderTimeAcceptablePriceRef = useRef<Price | null>(null);

  // ─── Start keeper execution ──────────────────────────────
  const start = useCallback((orderTimeAcceptablePrice: Price) => {
    if (runningRef.current) return; // Prevent double-start
    runningRef.current = true;
    cancelledRef.current = false;
    orderTimeAcceptablePriceRef.current = orderTimeAcceptablePrice;

    const runKeeper = async () => {
      // Step 1: Keeper steps (simulated delay)
      if (simulateKeeperDelayRef.current) {
        const delay = sampleKeeperDelay();
        const stepDelay = delay / 4;

        for (let step = 1; step <= 4; step++) {
          await new Promise((r) => setTimeout(r, stepDelay));
          if (cancelledRef.current) {
            runningRef.current = false;
            return;
          }
          setOrderStatusRef.current(`keeper_step_${step}` as OrderStatus);
        }
      } else {
        for (let step = 1; step <= 4; step++) {
          if (cancelledRef.current) {
            runningRef.current = false;
            return;
          }
          setOrderStatusRef.current(`keeper_step_${step}` as OrderStatus);
        }
      }

      if (cancelledRef.current) {
        runningRef.current = false;
        return;
      }

      // Step 2: Fetch fresh oracle price for fill
      const currentPriceData = usePaperStore.getState().prices[marketRef.current];

      if (!currentPriceData || currentPriceData.last <= 0) {
        setOrderStatusRef.current("failed");
        runningRef.current = false;
        return;
      }

      // Fill price for close:
      // Closing a long = selling → you get the lower (min) price
      // Closing a short = buying back → you pay the higher (max) price
      const fillPrice = determineFillPrice(
        currentPriceData.min,
        currentPriceData.max,
        directionRef.current,
        true // isClose = true
      );

      // Step 3: Slippage check for close (300 BPS = 3%)
      const orderAcceptablePrice = orderTimeAcceptablePriceRef.current;

      if (orderAcceptablePrice !== null) {
        // For closing:
        // Long close: fill price (min) must not be below acceptable price
        // Short close: fill price (max) must not exceed acceptable price
        const isSlippageExceeded = directionRef.current === "long"
          ? fillPrice < orderAcceptablePrice
          : fillPrice > orderAcceptablePrice;

        if (isSlippageExceeded) {
          console.info(
            `[PaperGMX] Close slippage exceeded: fillPrice=${fillPrice}, acceptablePrice=${orderAcceptablePrice}`
          );
          setOrderStatusRef.current("failed");
          runningRef.current = false;
          return;
        }
      }

      // ~5% chance of simulated execution failure (same as opens)
      const simulatedFailure = Math.random() < 0.05;

      if (simulatedFailure) {
        setOrderStatusRef.current("failed");
        runningRef.current = false;
        return;
      }

      // Step 4: Close the position in the store
      closePositionRef.current(fillPrice, closeReasonRef.current);
      setOrderStatusRef.current("filled");
      runningRef.current = false;
    };

    runKeeper();
  }, []); // No dependencies — all values via refs

  // ─── Cancel keeper execution ─────────────────────────────
  const cancel = useCallback(() => {
    if (!runningRef.current) return;
    cancelledRef.current = true;
    runningRef.current = false;

    const current = usePaperStore.getState().orderStatus;
    const transitions = ORDER_TRANSITIONS[current];
    const targetStatus: OrderStatus = (transitions as readonly OrderStatus[]).includes("cancelled" as OrderStatus)
      ? "cancelled"
      : "failed";

    setOrderStatusRef.current(targetStatus);
  }, []);

  return { start, cancel };
}
