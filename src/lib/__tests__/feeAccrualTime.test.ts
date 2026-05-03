import { describe, it, expect } from "vitest";
import {
  EPOCH_MS_MIN,
  normalizeEpochMs,
  resolveFeeAccrualFromMs,
} from "@/lib/feeAccrualTime";

describe("normalizeEpochMs", () => {
  it("treats sub-1e12 values as seconds", () => {
    const sec = 1_735_689_600; // ~2025 in seconds
    expect(normalizeEpochMs(sec)).toBe(sec * 1000);
    expect(normalizeEpochMs(sec * 1000)).toBeGreaterThanOrEqual(EPOCH_MS_MIN);
  });

  it("leaves millisecond epochs unchanged", () => {
    const ms = 1_735_689_600_000;
    expect(normalizeEpochMs(ms)).toBe(ms);
  });
});

describe("resolveFeeAccrualFromMs", () => {
  const opened = 1_735_689_600_000;

  it("uses openedAt when lastFeeAccrualAt is missing", () => {
    expect(resolveFeeAccrualFromMs(opened, undefined)).toBe(opened);
  });

  it("uses openedAt when lastFeeAccrualAt is 0 (invalid checkpoint)", () => {
    expect(resolveFeeAccrualFromMs(opened, 0)).toBe(opened);
  });

  it("uses the later of openedAt and lastFeeAccrualAt", () => {
    const last = opened + 60_000;
    expect(resolveFeeAccrualFromMs(opened, last)).toBe(last);
  });

  it("never returns a time before openedAt", () => {
    expect(resolveFeeAccrualFromMs(opened, opened - 3600_000)).toBe(opened);
  });
});
