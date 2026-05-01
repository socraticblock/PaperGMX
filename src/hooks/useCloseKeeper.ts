"use client";

import { useRef, useCallback, useMemo } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import type { OrderStatus, OrderDirection, Price, MarketSlug, BPS, ClosedTrade } from "@/types";
import { ORDER_TRANSITIONS } from "@/types";
import { determineFillPrice, determinePositionFeeBps } from "@/lib/calculations";
import { sampleKeeperDelay, KEEPER_FAILURE_RATE, DEFAULT_POSITION_FEE_BPS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────

export interface CloseKeeperResult {
  /** Start the keeper execution for closing. */
  start: (orderTimeAcceptablePrice: Price) => void;
  /** Cancel the keeper execution (only valid during steps 1-2). */
  cancel: () => void;
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
  // ─── Refs for latest values (avoid stale closures) ───────
  // NOTE: We use usePaperStore.getState().setOrderStatus() directly
  // in the async flow instead of a ref to avoid the stale-ref pattern.
  // Refs are assigned during render (not in useEffect) so async callbacks
  // always see the latest values — same pattern as useKeeperExecution.
  const marketRef = useRef(market);
  // eslint-disable-next-line react-hooks/refs
  marketRef.current = market;
  const directionRef = useRef(direction);
  // eslint-disable-next-line react-hooks/refs
  directionRef.current = direction;
  const closeReasonRef = useRef(closeReason);
  // eslint-disable-next-line react-hooks/refs
  closeReasonRef.current = closeReason;
  const simulateKeeperDelayRef = useRef(simulateKeeperDelay);
  // eslint-disable-next-line react-hooks/refs
  simulateKeeperDelayRef.current = simulateKeeperDelay;

  // ─── Cancellation + generation tracking ──────────────────
  const cancelledRef = useRef(false);
  const runningRef = useRef(false);
  const generationRef = useRef(0); // Prevents stale async flows after cancel+restart
  const orderTimeAcceptablePriceRef = useRef<Price | null>(null);

  // ─── Start keeper execution ──────────────────────────────
  const start = useCallback((orderTimeAcceptablePrice: Price) => {
    if (runningRef.current) return; // Prevent double-start
    runningRef.current = true;
    cancelledRef.current = false;
    const gen = ++generationRef.current; // Increment generation for this run
    orderTimeAcceptablePriceRef.current = orderTimeAcceptablePrice;

    const runKeeper = async () => {
      try {
        // Step 1: Keeper steps (simulated delay)
        if (simulateKeeperDelayRef.current) {
          const delay = sampleKeeperDelay();
          const stepDelay = delay / 4;

          for (let step = 1; step <= 4; step++) {
            await new Promise((r) => setTimeout(r, stepDelay));
            if (cancelledRef.current || generationRef.current !== gen) {
              runningRef.current = false;
              return;
            }
            usePaperStore.getState().setOrderStatus(`keeper_step_${step}` as OrderStatus);
          }
        } else {
          for (let step = 1; step <= 4; step++) {
            if (cancelledRef.current || generationRef.current !== gen) {
              runningRef.current = false;
              return;
            }
            usePaperStore.getState().setOrderStatus(`keeper_step_${step}` as OrderStatus);
          }
        }

        if (cancelledRef.current || generationRef.current !== gen) {
          runningRef.current = false;
          return;
        }

        // Step 2: Fetch fresh oracle price for fill
        const currentPriceData = usePaperStore.getState().prices[marketRef.current];

        if (!currentPriceData || currentPriceData.last <= 0) {
          usePaperStore.getState().setOrderStatus("failed");
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
            // GMX V2: slippage breach cancels the order, not fails it.
            // "cancelled" is the correct semantic — price moved beyond acceptable.
            usePaperStore.getState().setOrderStatus("cancelled");
            runningRef.current = false;
            return;
          }
        }

        // ~5% chance of simulated execution failure (same as opens)
        const simulatedFailure = Math.random() < KEEPER_FAILURE_RATE;

        if (simulatedFailure) {
          usePaperStore.getState().setOrderStatus("failed");
          runningRef.current = false;
          return;
        }

        // Step 4: Close the position in the store
        // GMX V2: close fee BPS is determined at close time based on OI balance.
        // We compute the close fee here and pass it to closePosition.
        const currentMarketInfo = usePaperStore.getState().marketInfo[marketRef.current];
        const closeFeeBps: BPS = currentMarketInfo
          ? determinePositionFeeBps(
              directionRef.current,
              true, // isClose = true
              currentMarketInfo.longOi,
              currentMarketInfo.shortOi,
            )
          : DEFAULT_POSITION_FEE_BPS;

        // closePosition no longer resets orderStatus — we manage the state machine here
        const positionBeforeClose = usePaperStore.getState().activePosition;
        usePaperStore.getState().closePosition(fillPrice, closeReasonRef.current, closeFeeBps);
        const positionAfterClose = usePaperStore.getState().activePosition;

        // Only transition to "filled" if closePosition actually closed a position.
        // If activePosition was already null (e.g., double-fire or external reset),
        // closePosition is a no-op and we should transition to "failed" instead
        // of leaving the order in an inconsistent "filled" state with no trade.
        if (positionBeforeClose && !positionAfterClose) {
          usePaperStore.getState().setOrderStatus("filled");
        } else {
          console.warn("[CloseKeeper] closePosition was a no-op — no active position to close");
          usePaperStore.getState().setOrderStatus("failed");
        }
        runningRef.current = false;
      } catch (error) {
        console.error("[CloseKeeper] Unexpected error:", error);
        usePaperStore.getState().setOrderStatus("failed");
        runningRef.current = false;
      }
    };

    runKeeper();
  }, []); // No dependencies — all values via refs

  // ─── Cancel keeper execution ─────────────────────────────
  const cancel = useCallback(() => {
    const current = usePaperStore.getState().orderStatus;

    // A close order can be in "submitted" before the async keeper loop starts
    // (for example, if price data vanished). The visible cancel button must
    // still provide an escape hatch from that state.
    if (!runningRef.current && current !== "submitted") return;

    cancelledRef.current = true;
    runningRef.current = false;

    const transitions = ORDER_TRANSITIONS[current];
    const targetStatus: OrderStatus = (transitions as readonly OrderStatus[]).includes("cancelled" as OrderStatus)
      ? "cancelled"
      : "failed";

    usePaperStore.getState().setOrderStatus(targetStatus);
  }, []);

  return useMemo(() => ({ start, cancel }), [start, cancel]);
}
