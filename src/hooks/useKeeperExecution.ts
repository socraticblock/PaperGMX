"use client";

import { useRef, useCallback } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import type { OrderDirection, OrderStatus, USD, Price, MarketSlug, BPS, Position } from "@/types";
import { ORDER_TRANSITIONS } from "@/types";
import { usd, timestamp } from "@/lib/branded";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateLiquidationPrice,
  determineFillPrice,
} from "@/lib/calculations";
import { MARKETS, DEFAULT_POSITION_FEE_BPS, KEEPER_TIMING_WEIGHTS, generatePositionId } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────

export interface KeeperExecutionResult {
  /** Start the keeper execution. Call when signing is confirmed. */
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
// Manages the keeper execution after the user confirms signing.
// Uses refs for all values to avoid stale closures in the async flow.
// Cancellation is handled via a ref (not useEffect cleanup) to prevent
// the self-cancellation bug that occurs when orderStatus changes trigger
// effect re-runs.
//
// IMPORTANT: This hook does NOT use useEffect. The keeper is started
// explicitly via the `start()` callback. This avoids the React effect
// cleanup race condition where changing orderStatus cancels the running
// async function.

export function useKeeperExecution(
  direction: OrderDirection,
  collateralUsd: USD,
  leverage: number,
  market: MarketSlug,
  simulateKeeperDelay: boolean,
  onSubmit: (position: Position) => void,
): KeeperExecutionResult {
  // ─── Store subscriptions ─────────────────────────────────
  const setOrderStatus = usePaperStore((s) => s.setOrderStatus);

  // ─── Refs for latest values (avoid stale closures) ───────
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const collateralUsdRef = useRef(collateralUsd);
  collateralUsdRef.current = collateralUsd;
  const leverageRef = useRef(leverage);
  leverageRef.current = leverage;
  const marketRef = useRef(market);
  marketRef.current = market;
  const simulateKeeperDelayRef = useRef(simulateKeeperDelay);
  simulateKeeperDelayRef.current = simulateKeeperDelay;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const setOrderStatusRef = useRef(setOrderStatus);
  setOrderStatusRef.current = setOrderStatus;

  // ─── Cancellation ref (checked at each step) ─────────────
  const cancelledRef = useRef(false);
  // Track if a keeper run is in progress to prevent double-start
  const runningRef = useRef(false);
  // Store the order-time acceptable price for real slippage validation
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
      // Read from store directly to get the LATEST prices
      const currentPriceData = usePaperStore.getState().prices[marketRef.current];
      const currentMarketInfo = usePaperStore.getState().marketInfo[marketRef.current];

      if (!currentPriceData || currentPriceData.last <= 0) {
        setOrderStatusRef.current("failed");
        runningRef.current = false;
        return;
      }

      const fillPrice = determineFillPrice(
        currentPriceData.min,
        currentPriceData.max,
        directionRef.current,
        false
      );

      // Step 3: Slippage check — compare order-time acceptable price
      // against execution-time fill price (real GMX V2 behavior)
      const orderAcceptablePrice = orderTimeAcceptablePriceRef.current;

      if (orderAcceptablePrice !== null) {
        // Real slippage check: did the price move beyond acceptable?
        // For longs: fill price must not exceed acceptable price
        // For shorts: fill price must not be below acceptable price
        const isSlippageExceeded = directionRef.current === "long"
          ? fillPrice > orderAcceptablePrice
          : fillPrice < orderAcceptablePrice;

        if (isSlippageExceeded) {
          console.info(
            `[PaperGMX] Slippage exceeded: fillPrice=${fillPrice}, acceptablePrice=${orderAcceptablePrice}`
          );
          setOrderStatusRef.current("failed");
          runningRef.current = false;
          return;
        }
      }

      // ~5% chance of simulated execution failure (spec 5.10)
      // This simulates edge cases like oracle delay, keeper issues, etc.
      const simulatedFailure = Math.random() < 0.05;

      if (simulatedFailure) {
        setOrderStatusRef.current("failed");
        runningRef.current = false;
        return;
      }

      // Step 4: Calculate position values
      const feeBps: BPS = currentMarketInfo?.positionFeeBps ?? DEFAULT_POSITION_FEE_BPS;
      const sizeUsd = calculatePositionSize(collateralUsdRef.current, leverageRef.current);
      const positionFeePaid = calculatePositionFee(sizeUsd, feeBps);
      const currentMarketConfig = MARKETS[marketRef.current];

      const liquidationPrice = calculateLiquidationPrice(
        directionRef.current,
        fillPrice,
        collateralUsdRef.current,
        sizeUsd,
        currentMarketConfig.maintenanceMarginBps,
        positionFeePaid,
        usd(0)
      );

      // Step 5: Create position
      const position: Position = {
        id: generatePositionId(marketRef.current, directionRef.current),
        market: marketRef.current,
        direction: directionRef.current,
        collateralUsd: collateralUsdRef.current,
        leverage: leverageRef.current,
        sizeUsd,
        entryPrice: fillPrice,
        acceptablePrice: orderTimeAcceptablePriceRef.current ?? fillPrice,
        liquidationPrice,
        positionFeeBps: feeBps,
        positionFeePaid,
        borrowFeeAccrued: usd(0),
        fundingFeeAccrued: usd(0),
        openedAt: timestamp(Date.now()),
        confirmedAt: null, // Will be set after 2-3s confirmation delay
        status: "confirming", // Starts as confirming, transitions to active
      };

      onSubmitRef.current(position);
      setOrderStatusRef.current("filled");
      runningRef.current = false;

      // Step 6: Confirmation delay — simulate on-chain confirmation
      // After 2-3s, update position status from "confirming" to "active"
      setTimeout(() => {
        const store = usePaperStore.getState();
        if (store.activePosition && store.activePosition.id === position.id) {
          usePaperStore.setState({
            activePosition: {
              ...store.activePosition,
              confirmedAt: timestamp(Date.now()),
              status: "active",
            },
          });
        }
      }, 2000 + Math.random() * 1000); // 2-3 seconds
    };

    runKeeper();
  }, []); // No dependencies — all values via refs

  // ─── Cancel keeper execution ─────────────────────────────
  const cancel = useCallback(() => {
    if (!runningRef.current) return;
    cancelledRef.current = true;
    runningRef.current = false;

    // Use "failed" as fallback if "cancelled" isn't a valid transition
    // from the current state (e.g., keeper_step_3 only allows → failed,
    // keeper_step_4 only allows → filled)
    const current = usePaperStore.getState().orderStatus;
    const transitions = ORDER_TRANSITIONS[current];
    const targetStatus: OrderStatus = (transitions as readonly OrderStatus[]).includes("cancelled" as OrderStatus)
      ? "cancelled"
      : "failed";

    setOrderStatusRef.current(targetStatus);
  }, []);

  return { start, cancel };
}
