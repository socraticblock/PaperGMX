/**
 * Store Integration Tests
 *
 * Tests the Zustand store's financial logic — balance deduction,
 * collateral locking, position closing, and order status transitions.
 * These verify that the store correctly orchestrates our pure
 * calculation functions with state management.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePaperStore } from "@/store/usePaperStore";
import { usd, price, bps, timestamp } from "@/lib/branded";
import type { Position, MarketSlug, OrderDirection } from "@/types";

// ─── Test Helpers ─────────────────────────────────────────

function createTestPosition(overrides?: Partial<Position>): Position {
  return {
    id: "eth-long-1700000000000",
    market: "eth" as MarketSlug,
    direction: "long" as OrderDirection,
    collateralUsd: usd(1000),
    leverage: 10,
    sizeUsd: usd(10000),
    entryPrice: price(3000),
    acceptablePrice: price(3015),
    liquidationPrice: price(2715),
    positionFeeBps: bps(6),
    positionFeePaid: usd(6),
    borrowFeeAccrued: usd(0),
    fundingFeeAccrued: usd(0),
    openedAt: timestamp(1700000000000),
    confirmedAt: null,
    status: "active",
    ...overrides,
  };
}

// ─── Reset store between tests ────────────────────────────

beforeEach(() => {
  const store = usePaperStore.getState();
  store.resetWallet();
  // Re-initialize with a known balance
  store.initializeBalance(10000);
});

// ─── Test Suite ───────────────────────────────────────────

describe("Store: Balance Management", () => {
  it("initializes balance correctly", () => {
    const { balance, isInitialized } = usePaperStore.getState();
    expect(balance).toBe(10000);
    expect(isInitialized).toBe(true);
  });

  it("tops up balance", () => {
    usePaperStore.getState().topUpBalance(5000);
    expect(usePaperStore.getState().balance).toBe(15000);
  });

  it("resets wallet to zero", () => {
    usePaperStore.getState().resetWallet();
    const { balance, isInitialized } = usePaperStore.getState();
    expect(balance).toBe(0);
    expect(isInitialized).toBe(false);
  });
});

describe("Store: Collateral Locking", () => {
  it("deducts collateral from balance", () => {
    usePaperStore.getState().lockCollateral(usd(2000));
    expect(usePaperStore.getState().balance).toBe(8000);
  });

  it("rejects lock if collateral exceeds balance (no change)", () => {
    usePaperStore.getState().lockCollateral(usd(15000));
    // Locking more than balance is rejected — balance stays unchanged
    expect(usePaperStore.getState().balance).toBe(10000);
  });

  it("handles zero collateral", () => {
    usePaperStore.getState().lockCollateral(usd(0));
    expect(usePaperStore.getState().balance).toBe(10000);
  });

  it("handles multiple sequential locks", () => {
    usePaperStore.getState().lockCollateral(usd(3000));
    usePaperStore.getState().lockCollateral(usd(2000));
    expect(usePaperStore.getState().balance).toBe(5000);
  });
});

describe("Store: Position Open Flow", () => {
  it("locks collateral and sets position", () => {
    const position = createTestPosition({ collateralUsd: usd(1000) });

    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().setActivePosition(position);

    const state = usePaperStore.getState();
    expect(state.balance).toBe(9000); // 10000 - 1000
    expect(state.activePosition).not.toBeNull();
    expect(state.activePosition?.collateralUsd).toBe(1000);
    expect(state.activePosition?.sizeUsd).toBe(10000);
  });

  it("liquidation price is properly stored (not zero)", () => {
    const position = createTestPosition({
      liquidationPrice: price(2715.9),
    });

    usePaperStore.getState().setActivePosition(position);
    expect(usePaperStore.getState().activePosition?.liquidationPrice).toBeGreaterThan(0);
  });

  it("confirmedAt is null when position is first created", () => {
    const position = createTestPosition({ confirmedAt: null });
    usePaperStore.getState().setActivePosition(position);
    expect(usePaperStore.getState().activePosition?.confirmedAt).toBeNull();
  });
});

describe("Store: Position Close Flow", () => {
  beforeEach(() => {
    const position = createTestPosition();
    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().setActivePosition(position);
  });

  it("returns collateral + P&L on profitable close", () => {
    // ETH moved from 3000 to 3300 (+10%), long position
    // Gross PnL = 10000 * 10% = 1000
    // Net PnL = 1000 - 6 (open fee) - 6 (close fee) = 988
    // Returned collateral = 1000 + 988 = 1988
    // New balance = 9000 (after lock) + 1988 = 10988
    usePaperStore.getState().closePosition(price(3300), "take_profit");

    const state = usePaperStore.getState();
    expect(state.activePosition).toBeNull();
    expect(state.balance).toBeCloseTo(10988, -1); // Within 10 due to rounding
    expect(state.orderStatus).toBe("idle");
  });

  it("deducts from collateral on loss close", () => {
    // ETH moved from 3000 to 2700 (-10%), long position
    // Gross PnL = 10000 * -10% = -1000
    // Net PnL = -1000 - 6 - 6 = -1012
    // Returned collateral = max(0, 1000 + (-1012)) = 0
    // New balance = 9000 + 0 = 9000
    usePaperStore.getState().closePosition(price(2700), "cut_loss");

    const state = usePaperStore.getState();
    expect(state.activePosition).toBeNull();
    expect(state.balance).toBe(9000); // Lost the collateral
  });

  it("resets orderStatus to idle after close", () => {
    // Walk through valid transitions to get to "filled"
    const { setOrderStatus } = usePaperStore.getState();
    setOrderStatus("approving");
    setOrderStatus("approved");
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");
    setOrderStatus("keeper_step_2");
    setOrderStatus("keeper_step_3");
    setOrderStatus("keeper_step_4");
    setOrderStatus("filled");
    expect(usePaperStore.getState().orderStatus).toBe("filled");

    usePaperStore.getState().closePosition(price(3300), "take_profit");
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("adds closed trade to history", () => {
    usePaperStore.getState().closePosition(price(3300), "take_profit");

    const { tradeHistory } = usePaperStore.getState();
    expect(tradeHistory.length).toBeGreaterThanOrEqual(1);
    const trade = tradeHistory[0]!;
    expect(trade.market).toBe("eth");
    expect(trade.direction).toBe("long");
    expect(trade.closeReason).toBe("take_profit");
  });
});

describe("Store: Order Status State Machine", () => {
  it("allows transition from idle to approving", () => {
    usePaperStore.getState().setOrderStatus("approving");
    expect(usePaperStore.getState().orderStatus).toBe("approving");
  });

  it("allows full happy path: idle -> approving -> approved -> signing -> submitted -> keeper steps -> filled", () => {
    const { setOrderStatus } = usePaperStore.getState();

    setOrderStatus("approving");
    setOrderStatus("approved");
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");
    setOrderStatus("keeper_step_2");
    setOrderStatus("keeper_step_3");
    setOrderStatus("keeper_step_4");
    setOrderStatus("filled");

    expect(usePaperStore.getState().orderStatus).toBe("filled");
  });

  it("allows transition from failed back to idle", () => {
    usePaperStore.getState().setOrderStatus("approving");
    usePaperStore.getState().setOrderStatus("failed");
    usePaperStore.getState().setOrderStatus("idle");

    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("rejects invalid transitions and keeps current state", () => {
    // Jump from idle directly to filled (invalid)
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    usePaperStore.getState().setOrderStatus("filled");

    // The store rejects the transition and stays at idle
    expect(usePaperStore.getState().orderStatus).toBe("idle");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
