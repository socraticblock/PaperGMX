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

    // Initialize accrual time on first run for this position.
    // Use the position's openedAt timestamp to avoid the first-cycle fee
    // gap (previously used `now`, which skipped the first 3 seconds of fees).
    if (lastAccrualTimeRef.current === 0) {
      lastAccrualTimeRef.current = position.openedAt;
      return;
    }

    const durationMs = now - lastAccrualTimeRef.current;

    // Skip if less than one price poll interval has elapsed
    if (durationMs < PRICE_POLL_INTERVAL) return;

    const info = marketInfo[position.market];
    if (!info) return;

    // Calculate borrow fee delta
    // GMX V2 invariant: the smaller OI side pays ZERO borrow fee.
    // The API should already return 0 for the smaller side, but we enforce
    // it client-side to guarantee fidelity even if the API data is stale.
    const longOi = info.longOi ?? 0;
    const shortOi = info.shortOi ?? 0;
    const isSmallerSide =
      position.direction === "long"
        ? longOi <= shortOi
        : shortOi <= longOi;
    const borrowRatePerSecond =
      isSmallerSide
        ? 0
        : (position.direction === "long" ? info.borrowRateLong : info.borrowRateShort);

    const borrowFeeDelta = calculateBorrowFee(
      position.sizeUsd,
      borrowRatePerSecond,
      durationMs,
    );

    // Calculate funding fee delta
    // GMX V2: longs and shorts have separate funding rates.
    // fundingRateLong > 0 means longs pay shorts.
    // fundingRateShort > 0 means shorts pay longs.
    // Both can be non-zero simultaneously (different from perp exchanges).
    const fundingRatePerSecond =
      position.direction === "long"
        ? info.fundingRateLong
        : info.fundingRateShort;

    // calculateFundingFee uses the rate's sign to determine payer direction:
    //   positive rate = position pays (cost), negative rate = position receives (credit).
    // Since we already selected the per-direction rate above, no direction
    // parameter is needed — the sign IS the direction signal.
    const fundingFeeDelta = calculateFundingFee(
      position.sizeUsd,
      fundingRatePerSecond,
      durationMs,
    );

    // Update the position's accrued fees
    updatePositionFees(borrowFeeDelta, fundingFeeDelta);

    // Mark this accrual time
    lastAccrualTimeRef.current = now;
  }, [position, prices, marketInfo, updatePositionFees]);
}
