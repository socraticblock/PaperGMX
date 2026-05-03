"use client";

import { useEffect, useRef } from "react";
import { timestamp } from "@/lib/branded";
import { resolveFeeAccrualFromMs } from "@/lib/feeAccrualTime";
import { usePaperStore } from "@/store/usePaperStore";
import type { Position, MarketSlug, PriceData } from "@/types";
import { calculateFeeAccrualDelta } from "@/lib/positionEngine";
import { PRICE_POLL_INTERVAL } from "@/lib/constants";

// ─── Hook ────────────────────────────────────────────────

/**
 * Accrues borrow and funding fees for every active position.
 *
 * Uses GMX `/markets/info` per-second rates from the store (same source as the
 * live app) and integrates over **wall-clock** elapsed time since each
 * position's `lastFeeAccrualAt`, including across browser sessions when state
 * is persisted. This matches the intent of on-chain continuous accrual; the
 * remaining gap vs exact chain settlement is that each tick applies the
 * **latest** API snapshot over the whole interval (GMX updates factors
 * continuously on-chain).
 *
 * Multi-position model: per-position checkpoints live on the position itself
 * (`lastFeeAccrualAt`). The Map below is just a defensive in-memory backup so
 * that even if the position is briefly out of sync we don't double-charge.
 */
export function useFeeAccrual(
  positions: Position[],
  prices: Record<MarketSlug, PriceData>,
): void {
  const updatePositionFees = usePaperStore((s) => s.updatePositionFees);
  const marketInfo = usePaperStore((s) => s.marketInfo);

  // Per-id "last accrual ms" cache so a position that just appeared mid-tick
  // can't double-charge if React re-runs the effect with stale store state.
  const lastAccrualByIdRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (positions.length === 0) return;

    const cache = lastAccrualByIdRef.current;
    const now = Date.now();

    for (const position of positions) {
      if (position.status !== "active") continue;
      const info = marketInfo[position.market];
      if (!info) continue;

      const checkpointFromPosition = resolveFeeAccrualFromMs(
        Number(position.openedAt),
        position.lastFeeAccrualAt != null
          ? Number(position.lastFeeAccrualAt)
          : undefined,
      );
      const cached = cache.get(position.id);
      const from = cached != null ? Math.max(cached, checkpointFromPosition) : checkpointFromPosition;
      const durationMs = Math.max(0, now - Math.min(from, now));
      if (durationMs < PRICE_POLL_INTERVAL) continue;

      const { borrowFeeDelta, fundingFeeDelta } = calculateFeeAccrualDelta(
        position,
        info,
        durationMs,
      );

      updatePositionFees(
        position.id,
        borrowFeeDelta,
        fundingFeeDelta,
        timestamp(now),
      );
      cache.set(position.id, now);
    }

    // Drop cache entries for positions that no longer exist.
    if (cache.size > positions.length) {
      const liveIds = new Set(positions.map((p) => p.id));
      for (const id of cache.keys()) {
        if (!liveIds.has(id)) cache.delete(id);
      }
    }
  }, [positions, prices, marketInfo, updatePositionFees]);
}
