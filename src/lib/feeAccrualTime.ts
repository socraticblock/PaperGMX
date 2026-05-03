/**
 * Wall-clock bounds for fee accrual. GMX uses ms epoch times; some edge cases
 * (corrupt storage, `0` checkpoints, or second-based values) must not produce
 * multi-year accrual in a single tick.
 */

/** Values below this are treated as Unix **seconds** and converted to ms. */
export const EPOCH_MS_MIN = 1_000_000_000_000; // ~2001-09-09 in ms

/**
 * Normalise a Unix time that may be in **seconds** (common off-by-1e3 bug) to ms.
 */
export function normalizeEpochMs(t: number): number {
  if (!Number.isFinite(t) || t <= 0) return t;
  if (t < EPOCH_MS_MIN) return t * 1000;
  return t;
}

/**
 * Start instant (ms) for the next borrow/funding accrual window.
 * - Never uses `0` as a valid checkpoint (`0 ?? opened` is a footgun in JS).
 * - Clamps to `openedAt` so we never accrue “before the position existed”.
 */
export function resolveFeeAccrualFromMs(
  openedAt: number,
  lastFeeAccrualAt: number | undefined,
): number {
  const opened = normalizeEpochMs(openedAt);
  if (!Number.isFinite(opened) || opened <= 0) {
    return Date.now();
  }
  if (
    lastFeeAccrualAt == null ||
    !Number.isFinite(lastFeeAccrualAt) ||
    lastFeeAccrualAt <= 0
  ) {
    return opened;
  }
  const last = normalizeEpochMs(lastFeeAccrualAt);
  if (!Number.isFinite(last) || last <= 0) {
    return opened;
  }
  return Math.max(opened, last);
}
