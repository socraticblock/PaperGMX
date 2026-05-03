"use client";

import { useEffect, useRef } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type {
  Position,
  PriceData,
  MarketSlug,
  Price,
  OrderStatus,
} from "@/types";
import { addUSD, bpsToDecimal, percent, usd } from "@/lib/branded";
import {
  calculateGrossPnl,
  calculateNetPnl,
  calculatePositionFee,
} from "@/lib/calculations";
import {
  capPositivePnl,
  getMarkPrice,
  getMaxPnlFactorForTraders,
  getPositionFeeBps,
  getWorstClosePrice,
} from "@/lib/positionEngine";
import { MARKETS } from "@/lib/constants";

// ─── Per-position eval (mirrors usePositionPnl's isLiquidatable path) ──

function evaluateLiquidation(
  position: Position,
  prices: Record<MarketSlug, PriceData>,
  marketInfo: ReturnType<typeof usePaperStore.getState>["marketInfo"],
): { isLiquidatable: boolean; exitPrice: Price | null } {
  if (position.status !== "active") {
    return { isLiquidatable: false, exitPrice: null };
  }
  const priceData = prices[position.market];
  if (!priceData || priceData.last <= 0) {
    return { isLiquidatable: false, exitPrice: null };
  }
  const info = marketInfo[position.market];
  const marketConfig = MARKETS[position.market];

  const midPrice = getMarkPrice(priceData);
  const worstClosePrice = getWorstClosePrice(position.direction, priceData);

  let grossPnl = calculateGrossPnl(
    position.direction,
    position.entryPrice,
    midPrice,
    position.sizeUsd,
    position.sizeInTokens,
  );
  grossPnl = capPositivePnl(
    grossPnl,
    position.sizeUsd,
    getMaxPnlFactorForTraders(info),
  );

  const closeFeeBps = getPositionFeeBps(position.direction, true, info);
  const positionFeeClose = calculatePositionFee(position.sizeUsd, closeFeeBps);
  const netPnl = calculateNetPnl(
    grossPnl,
    position.positionFeePaid,
    positionFeeClose,
    position.borrowFeeAccrued,
    position.fundingFeeAccrued,
  );

  const remainingCollateral = addUSD(position.collateralUsd, netPnl);
  const minCollateralUsdFloor = usd(1);
  const minCollateral =
    position.sizeUsd * bpsToDecimal(marketConfig.maintenanceMarginBps);
  const requiredMinCollateral = Math.max(
    Number(minCollateral),
    minCollateralUsdFloor,
  );
  // Defensive: silence unused var if tooling complains
  void percent;

  return {
    isLiquidatable: remainingCollateral <= requiredMinCollateral,
    exitPrice: worstClosePrice,
  };
}

// ─── Hook ────────────────────────────────────────────────

/**
 * Continuously monitors every active position for liquidation conditions.
 * Runs on the same cadence as price updates (every 3 seconds).
 *
 * For each position that becomes liquidatable:
 *   1. Calls closePosition(p.id, worstClosePrice, "liquidated") on the store
 *   2. If `orderStatus` is idle, transitions it to "filled" so the UI can
 *      show the liquidation result. If a manual close is in flight on a
 *      DIFFERENT position, we still close the liquidated one but leave
 *      orderStatus alone so we don't disrupt the in-flight order.
 *
 * Multi-position model: liquidations are tracked per id via a Set ref so
 * the same position can't be double-liquidated within a single render cycle.
 */
export function useLiquidationChecker(
  positions: Position[],
  prices: Record<MarketSlug, PriceData>,
): void {
  const { closePosition } = usePaperStore(
    useShallow((s) => ({
      closePosition: s.closePosition,
    })),
  );

  const triggeredRef = useRef<Set<string>>(new Set());

  // Drop dedup entries for positions that no longer exist so the set
  // doesn't grow unbounded across many open/close cycles.
  useEffect(() => {
    const live = new Set(positions.map((p) => p.id));
    const triggered = triggeredRef.current;
    for (const id of triggered) {
      if (!live.has(id)) triggered.delete(id);
    }
  }, [positions]);

  useEffect(() => {
    if (positions.length === 0) return;

    const marketInfo = usePaperStore.getState().marketInfo;

    // Snapshot positions to avoid races if the array mutates during the loop.
    const snapshot = positions.slice();

    for (const pos of snapshot) {
      if (triggeredRef.current.has(pos.id)) continue;

      const { isLiquidatable, exitPrice } = evaluateLiquidation(
        pos,
        prices,
        marketInfo,
      );
      if (!isLiquidatable || !exitPrice) continue;

      // Mark immediately to prevent re-entry within the same cycle.
      triggeredRef.current.add(pos.id);

      // Close the liquidated position. closePosition is per-id so other
      // positions are unaffected.
      closePosition(pos.id, exitPrice, "liquidated");

      // Bump orderStatus to "filled" so the UI can surface the result, but
      // ONLY when the order machine is idle. If a manual order is mid-flight
      // (the keeper machine is busy), leave it alone — the liquidation still
      // closed the position, the user just won't get a per-liquidation popup
      // until the in-flight order finishes.
      const store = usePaperStore.getState();
      if (store.orderStatus === "idle") {
        if (store.tradingMode === "1ct" && store.oneClickTrading.enabled) {
          store.decrementOneClickActions();
        }
        usePaperStore.setState(
          { orderStatus: "filled" as OrderStatus },
          false,
          "useLiquidationChecker/liquidation-filled",
        );
      }
    }
  }, [positions, prices, closePosition]);
}
