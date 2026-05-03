"use client";

import { useEffect } from "react";
import { timestamp } from "@/lib/branded";
import { resolveFeeAccrualFromMs } from "@/lib/feeAccrualTime";
import { usePaperStore } from "@/store/usePaperStore";
import type { Position, MarketSlug, PriceData } from "@/types";
import { calculateFeeAccrualDelta } from "@/lib/positionEngine";
import { PRICE_POLL_INTERVAL } from "@/lib/constants";

// ─── Hook ────────────────────────────────────────────────

/**
 * Accrues borrow and funding fees for an active position.
 *
 * Uses GMX `/markets/info` per-second rates from the store (same source as the
 * live app) and integrates over **wall-clock** elapsed time since
 * `lastFeeAccrualAt`, including across browser sessions when state is persisted.
 * This matches the intent of on-chain continuous accrual; the remaining gap vs
 * exact chain settlement is that each tick applies the **latest** API snapshot
 * over the whole interval (GMX updates factors continuously on-chain).
 */
export function useFeeAccrual(
  position: Position | null,
  prices: Record<MarketSlug, PriceData>,
): void {
  const updatePositionFees = usePaperStore((s) => s.updatePositionFees);
  const marketInfo = usePaperStore((s) => s.marketInfo);

  useEffect(() => {
    if (!position || position.status !== "active") {
      return;
    }

    const info = marketInfo[position.market];
    if (!info) return;

    const now = Date.now();
    const from = resolveFeeAccrualFromMs(
      Number(position.openedAt),
      position.lastFeeAccrualAt != null
        ? Number(position.lastFeeAccrualAt)
        : undefined,
    );
    const durationMs = Math.max(0, now - Math.min(from, now));

    if (durationMs < PRICE_POLL_INTERVAL) {
      return;
    }

    const { borrowFeeDelta, fundingFeeDelta } = calculateFeeAccrualDelta(
      position,
      info,
      durationMs,
    );

    updatePositionFees(borrowFeeDelta, fundingFeeDelta, timestamp(now));
  }, [position, prices, marketInfo, updatePositionFees]);
}
