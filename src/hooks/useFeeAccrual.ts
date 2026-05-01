"use client";

import { useEffect, useRef } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import type { Position, MarketSlug, PriceData } from "@/types";
import { calculateBorrowFee, calculateFundingFee } from "@/lib/calculations";
import { PRICE_POLL_INTERVAL } from "@/lib/constants";

// ─── Hook ────────────────────────────────────────────────

/**
 * Accrues borrow and funding fees for an active position.
 *
 * This hook runs on the same cadence as price updates (every 3 seconds)
 * and calculates the fee delta since the last accrual. It calls
 * `updatePositionFees` on the store to accumulate the fees.
 *
 * Without this hook, `borrowFeeAccrued` and `fundingFeeAccrued` on the
 * position remain at $0, making the entire borrow/funding/liquidation
 * system non-functional.
 */
export function useFeeAccrual(
  position: Position | null,
  prices: Record<MarketSlug, PriceData>,
): void {
  const updatePositionFees = usePaperStore((s) => s.updatePositionFees);
  const marketInfo = usePaperStore((s) => s.marketInfo);

  // Track the last timestamp we accrued fees at
  const lastAccrualTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!position || position.status !== "active") {
      // Reset accrual time when there's no active position
      lastAccrualTimeRef.current = 0;
      return;
    }

    const now = Date.now();

    // Initialize accrual time on first run for this position
    if (lastAccrualTimeRef.current === 0) {
      lastAccrualTimeRef.current = now;
      return;
    }

    const durationMs = now - lastAccrualTimeRef.current;

    // Skip if less than one price poll interval has elapsed
    if (durationMs < PRICE_POLL_INTERVAL) return;

    const info = marketInfo[position.market];
    if (!info) return;

    // Calculate borrow fee delta
    const borrowRatePerSecond =
      position.direction === "long"
        ? info.borrowRateLong
        : info.borrowRateShort;

    const borrowFeeDelta = calculateBorrowFee(
      position.sizeUsd,
      borrowRatePerSecond,
      durationMs,
    );

    // Calculate funding fee delta
    const fundingFeeDelta = calculateFundingFee(
      position.sizeUsd,
      info.fundingRate,
      durationMs,
      position.direction,
    );

    // Update the position's accrued fees
    updatePositionFees(borrowFeeDelta, fundingFeeDelta);

    // Mark this accrual time
    lastAccrualTimeRef.current = now;
  }, [position, prices, marketInfo, updatePositionFees]);
}
