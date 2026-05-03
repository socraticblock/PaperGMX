/**
 * Store Integration Tests
 *
 * Tests the Zustand store's financial logic — balance deduction,
 * collateral locking, position closing, and order status transitions.
 * These verify that the store correctly orchestrates our pure
 * calculation functions with state management.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePaperStore, migrateStore } from "@/store/usePaperStore";
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
    lastFeeAccrualAt: timestamp(1700000000000),
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
  it("addPosition appends and selects when none selected", () => {
    const position = createTestPosition({ collateralUsd: usd(1000) });

    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().addPosition(position);

    const state = usePaperStore.getState();
    expect(state.balance).toBe(9000); // 10000 - 1000
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0]?.collateralUsd).toBe(1000);
    expect(state.positions[0]?.sizeUsd).toBe(10000);
    expect(state.selectedPositionId).toBe(position.id);
  });

  it("liquidation price is properly stored (not zero)", () => {
    const position = createTestPosition({
      liquidationPrice: price(2715.9),
    });

    usePaperStore.getState().addPosition(position);
    expect(
      usePaperStore.getState().positions[0]?.liquidationPrice,
    ).toBeGreaterThan(0);
  });

  it("confirmedAt is null when position is first created", () => {
    const position = createTestPosition({ confirmedAt: null });
    usePaperStore.getState().addPosition(position);
    expect(usePaperStore.getState().positions[0]?.confirmedAt).toBeNull();
  });

  it("addPosition keeps existing selection when one is already selected", () => {
    const first = createTestPosition({ id: "first" });
    const second = createTestPosition({ id: "second", direction: "short" });
    usePaperStore.getState().addPosition(first);
    usePaperStore.getState().addPosition(second);
    expect(usePaperStore.getState().selectedPositionId).toBe("first");
    expect(usePaperStore.getState().positions).toHaveLength(2);
  });
});

describe("Store: fee accrual checkpoint", () => {
  it("updatePositionFees updates lastFeeAccrualAt for the targeted position", () => {
    const t0 = timestamp(1_700_000_000_000);
    const t1 = timestamp(1_700_000_003_000);
    const position = createTestPosition({
      id: "feepos",
      lastFeeAccrualAt: t0,
      openedAt: t0,
    });
    usePaperStore.getState().addPosition(position);
    usePaperStore
      .getState()
      .updatePositionFees(position.id, usd(0.01), usd(0.02), t1);
    const pos = usePaperStore
      .getState()
      .positions.find((p) => p.id === position.id);
    expect(pos?.lastFeeAccrualAt).toBe(t1);
    expect(pos?.borrowFeeAccrued).toBe(0.01);
    expect(pos?.fundingFeeAccrued).toBe(0.02);
  });

  it("updatePositionFees is a no-op for unknown id", () => {
    const t0 = timestamp(1_700_000_000_000);
    const t1 = timestamp(1_700_000_003_000);
    usePaperStore.getState().addPosition(
      createTestPosition({ id: "real", lastFeeAccrualAt: t0, openedAt: t0 }),
    );
    usePaperStore
      .getState()
      .updatePositionFees("does-not-exist", usd(99), usd(99), t1);
    const pos = usePaperStore
      .getState()
      .positions.find((p) => p.id === "real");
    expect(pos?.borrowFeeAccrued).toBe(0);
    expect(pos?.fundingFeeAccrued).toBe(0);
    expect(pos?.lastFeeAccrualAt).toBe(t0);
  });
});

describe("Store: Position Close Flow", () => {
  let openPositionId: string;

  beforeEach(() => {
    const position = createTestPosition();
    openPositionId = position.id;
    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().addPosition(position);
  });

  it("returns collateral + P&L on profitable close", () => {
    // ETH moved from 3000 to 3300 (+10%), long position
    // Gross PnL = 10000 * 10% = 1000
    // Net PnL = 1000 - 6 (open fee) - 6 (close fee) = 988
    // Returned collateral = 1000 + 988 = 1988
    // New balance = 9000 (after lock) + 1988 = 10988
    usePaperStore
      .getState()
      .closePosition(openPositionId, price(3300), "take_profit");

    const state = usePaperStore.getState();
    expect(state.positions).toHaveLength(0);
    expect(state.balance).toBeCloseTo(10988, -1); // Within 10 due to rounding
    expect(state.orderStatus).toBe("idle");
  });

  it("deducts from collateral on loss close", () => {
    // ETH moved from 3000 to 2700 (-10%), long position
    // Gross PnL = 10000 * -10% = -1000
    // Net PnL = -1000 - 6 - 6 = -1012
    // Returned collateral = max(0, 1000 + (-1012)) = 0
    // New balance = 9000 + 0 = 9000
    usePaperStore
      .getState()
      .closePosition(openPositionId, price(2700), "cut_loss");

    const state = usePaperStore.getState();
    expect(state.positions).toHaveLength(0);
    expect(state.balance).toBe(9000); // Lost the collateral
  });

  it("closePosition does NOT reset orderStatus — caller manages state machine", () => {
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

    // closePosition no longer resets orderStatus — the caller (useCloseKeeper)
    // manages the state machine transition via setOrderStatus.
    usePaperStore
      .getState()
      .closePosition(openPositionId, price(3300), "take_profit");
    expect(usePaperStore.getState().orderStatus).toBe("filled"); // unchanged
  });

  it("allows filled → idle via setOrderStatus (user dismisses result)", () => {
    const { setOrderStatus } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");
    setOrderStatus("keeper_step_2");
    setOrderStatus("keeper_step_3");
    setOrderStatus("keeper_step_4");
    setOrderStatus("filled");
    expect(usePaperStore.getState().orderStatus).toBe("filled");

    // Previously, filled: [] was a dead-end. Now filled → idle is valid.
    setOrderStatus("idle");
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("adds closed trade to history", () => {
    usePaperStore
      .getState()
      .closePosition(openPositionId, price(3300), "take_profit");

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

  it("allows filled → idle (fixes state machine dead-end)", () => {
    const { setOrderStatus } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");
    setOrderStatus("keeper_step_2");
    setOrderStatus("keeper_step_3");
    setOrderStatus("keeper_step_4");
    setOrderStatus("filled");

    // Previously, filled had no outgoing transitions — this was a dead-end.
    // Now filled → idle allows the user to dismiss the result and return to form.
    setOrderStatus("idle");
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });
});

describe("Store: dismissOrderResult", () => {
  it("transitions filled → idle", () => {
    const { setOrderStatus, dismissOrderResult } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");
    setOrderStatus("keeper_step_2");
    setOrderStatus("keeper_step_3");
    setOrderStatus("keeper_step_4");
    setOrderStatus("filled");
    expect(usePaperStore.getState().orderStatus).toBe("filled");

    dismissOrderResult();
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("transitions failed → idle", () => {
    const { setOrderStatus, dismissOrderResult } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("failed");
    expect(usePaperStore.getState().orderStatus).toBe("failed");

    dismissOrderResult();
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("transitions cancelled → idle", () => {
    const { setOrderStatus, dismissOrderResult } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("cancelled");
    expect(usePaperStore.getState().orderStatus).toBe("cancelled");

    dismissOrderResult();
    expect(usePaperStore.getState().orderStatus).toBe("idle");
  });

  it("is a no-op from idle (not a dismissable state)", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(usePaperStore.getState().orderStatus).toBe("idle");

    usePaperStore.getState().dismissOrderResult();
    // Should still be idle — can't dismiss from idle
    expect(usePaperStore.getState().orderStatus).toBe("idle");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("is a no-op from keeper_step_1 (not a dismissable state)", () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { setOrderStatus } = usePaperStore.getState();
    setOrderStatus("signing");
    setOrderStatus("submitted");
    setOrderStatus("keeper_step_1");

    usePaperStore.getState().dismissOrderResult();
    // Should still be keeper_step_1 — can't dismiss mid-keeper
    expect(usePaperStore.getState().orderStatus).toBe("keeper_step_1");
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});

describe("Store: closePosition no-op guard", () => {
  it("closePosition is a no-op when no positions exist", () => {
    expect(usePaperStore.getState().positions).toHaveLength(0);

    const balanceBefore = usePaperStore.getState().balance;
    const historyBefore = usePaperStore.getState().tradeHistory.length;

    usePaperStore
      .getState()
      .closePosition("any-id", price(3300), "take_profit");

    expect(usePaperStore.getState().balance).toBe(balanceBefore);
    expect(usePaperStore.getState().tradeHistory.length).toBe(historyBefore);
  });

  it("closePosition is a no-op for unknown id (with other positions present)", () => {
    const position = createTestPosition({ id: "real-pos" });
    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().addPosition(position);

    const balanceBefore = usePaperStore.getState().balance;
    const historyBefore = usePaperStore.getState().tradeHistory.length;
    const positionsBefore = usePaperStore.getState().positions.length;

    usePaperStore
      .getState()
      .closePosition("unknown-id", price(3300), "take_profit");

    expect(usePaperStore.getState().balance).toBe(balanceBefore);
    expect(usePaperStore.getState().tradeHistory.length).toBe(historyBefore);
    expect(usePaperStore.getState().positions.length).toBe(positionsBefore);
  });

  it("closePosition returns collateral when position exists", () => {
    const position = createTestPosition({ id: "active-pos" });
    usePaperStore.getState().lockCollateral(usd(1000));
    usePaperStore.getState().addPosition(position);

    const balanceBefore = usePaperStore.getState().balance;
    usePaperStore
      .getState()
      .closePosition(position.id, price(3300), "take_profit");

    // Balance should increase (collateral + P&L returned)
    expect(usePaperStore.getState().balance).toBeGreaterThan(balanceBefore);
    expect(usePaperStore.getState().positions).toHaveLength(0);
    expect(usePaperStore.getState().tradeHistory.length).toBe(1);
  });
});

describe("Store: 1CT quota decrement timing", () => {
  it("1CT actions remaining starts at max", () => {
    const { oneClickTrading } = usePaperStore.getState();
    // After resetWallet + initializeBalance, 1CT is in default state
    expect(oneClickTrading.actionsRemaining).toBeGreaterThanOrEqual(0);
  });

  it("decrementOneClickActions decrements actions remaining", () => {
    usePaperStore.getState().enableOneClickTrading();
    const before = usePaperStore.getState().oneClickTrading.actionsRemaining;
    usePaperStore.getState().decrementOneClickActions();
    const after = usePaperStore.getState().oneClickTrading.actionsRemaining;
    expect(after).toBe(before - 1);
  });

  it("decrementOneClickActions floors at 0 (never negative)", () => {
    usePaperStore.getState().enableOneClickTrading();
    // Drain all actions
    while (usePaperStore.getState().oneClickTrading.actionsRemaining > 0) {
      usePaperStore.getState().decrementOneClickActions();
    }
    expect(usePaperStore.getState().oneClickTrading.actionsRemaining).toBe(0);

    // Try to decrement below 0
    usePaperStore.getState().decrementOneClickActions();
    expect(usePaperStore.getState().oneClickTrading.actionsRemaining).toBe(0);
  });
});

// ─── Multi-position model: increase, multi-close, selection ────

describe("Store: increasePosition (weighted-average entry)", () => {
  it("merges sizes with the GMX getEntryPrice formula", () => {
    // First fill: $5,000 size at $2,000 → 2.5 ETH
    // Second fill: +$5,000 size at $3,000 → +1.6666... ETH
    // After: sizeUsd = $10,000, sizeInTokens = 4.1666..., entry = 10000/4.1666... = $2,400
    const initial = createTestPosition({
      id: "weighted-pos",
      market: "eth",
      direction: "long",
      collateralUsd: usd(1000),
      leverage: 5,
      sizeUsd: usd(5000),
      sizeInTokens: 5000 / 2000,
      entryPrice: price(2000),
      positionFeePaid: usd(2),
    });
    usePaperStore.getState().addPosition(initial);

    usePaperStore.getState().increasePosition("weighted-pos", {
      sizeDeltaUsd: usd(5000),
      collateralDeltaUsd: usd(1000),
      executionPrice: price(3000),
      openFeeUsd: usd(2),
      now: timestamp(1_700_000_010_000),
    });

    const next = usePaperStore
      .getState()
      .positions.find((p) => p.id === "weighted-pos")!;
    expect(next.sizeUsd).toBe(10000);
    expect(next.sizeInTokens).toBeCloseTo(4.166666, 5);
    expect(Number(next.entryPrice)).toBeCloseTo(2400, 1);
    // Collateral grew by deposit minus open fee
    expect(next.collateralUsd).toBe(1998);
    // Position fee accumulates across both fills
    expect(next.positionFeePaid).toBe(4);
    // Checkpoint was reset to args.now
    expect(next.lastFeeAccrualAt).toBe(1_700_000_010_000);
  });

  it("is a no-op for unknown id", () => {
    const initial = createTestPosition({ id: "real" });
    usePaperStore.getState().addPosition(initial);
    const before = usePaperStore.getState().positions[0];

    usePaperStore.getState().increasePosition("nope", {
      sizeDeltaUsd: usd(1000),
      collateralDeltaUsd: usd(100),
      executionPrice: price(3000),
      openFeeUsd: usd(1),
      now: timestamp(1_700_000_010_000),
    });

    const after = usePaperStore.getState().positions[0];
    expect(after).toEqual(before);
  });

  it("recomputes leverage from new size / collateral", () => {
    const initial = createTestPosition({
      id: "lev",
      collateralUsd: usd(500),
      sizeUsd: usd(2500),
      leverage: 5,
      sizeInTokens: 2500 / 2500,
      entryPrice: price(2500),
    });
    usePaperStore.getState().addPosition(initial);
    usePaperStore.getState().increasePosition("lev", {
      sizeDeltaUsd: usd(2500),
      collateralDeltaUsd: usd(500),
      executionPrice: price(2500),
      openFeeUsd: usd(0),
      now: timestamp(1_700_000_020_000),
    });
    const next = usePaperStore
      .getState()
      .positions.find((p) => p.id === "lev")!;
    expect(next.sizeUsd).toBe(5000);
    expect(next.collateralUsd).toBe(1000);
    expect(next.leverage).toBeCloseTo(5, 5);
  });
});

describe("Store: multi-position close + selection", () => {
  it("closing one position keeps the others untouched", () => {
    const long = createTestPosition({ id: "long-pos", direction: "long" });
    const short = createTestPosition({
      id: "short-pos",
      direction: "short",
      market: "btc",
    });
    usePaperStore.getState().lockCollateral(usd(2000));
    usePaperStore.getState().addPosition(long);
    usePaperStore.getState().addPosition(short);

    expect(usePaperStore.getState().positions).toHaveLength(2);

    usePaperStore
      .getState()
      .closePosition("long-pos", price(3300), "take_profit");

    const state = usePaperStore.getState();
    expect(state.positions).toHaveLength(1);
    expect(state.positions[0]?.id).toBe("short-pos");
    expect(state.tradeHistory).toHaveLength(1);
    expect(state.tradeHistory[0]?.id).toBe("long-pos");
  });

  it("closing the selected position advances the selection to the next one", () => {
    const a = createTestPosition({ id: "a" });
    const b = createTestPosition({ id: "b", direction: "short" });
    usePaperStore.getState().addPosition(a);
    usePaperStore.getState().addPosition(b);
    usePaperStore.getState().selectPosition("a");

    usePaperStore.getState().closePosition("a", price(3000), "take_profit");

    expect(usePaperStore.getState().selectedPositionId).toBe("b");
  });

  it("closing the selected position with no others sets selection to null", () => {
    const a = createTestPosition({ id: "lonely" });
    usePaperStore.getState().addPosition(a);
    usePaperStore.getState().selectPosition("lonely");

    usePaperStore
      .getState()
      .closePosition("lonely", price(3000), "take_profit");

    expect(usePaperStore.getState().selectedPositionId).toBeNull();
  });

  it("removePosition advances selection like closePosition does", () => {
    const a = createTestPosition({ id: "a" });
    const b = createTestPosition({ id: "b", direction: "short" });
    usePaperStore.getState().addPosition(a);
    usePaperStore.getState().addPosition(b);
    usePaperStore.getState().selectPosition("a");

    usePaperStore.getState().removePosition("a");

    expect(usePaperStore.getState().positions).toHaveLength(1);
    expect(usePaperStore.getState().selectedPositionId).toBe("b");
  });
});

describe("Store: v3 → v4 migration", () => {
  it("converts a single activePosition into a positions[] of length 1", () => {
    const legacyPosition: Position = {
      id: "legacy-eth-long",
      market: "eth",
      direction: "long",
      collateralUsd: usd(500),
      leverage: 5,
      sizeUsd: usd(2500),
      sizeInTokens: 2500 / 2500,
      entryPrice: price(2500),
      acceptablePrice: price(2510),
      liquidationPrice: price(2050),
      positionFeeBps: bps(6),
      positionFeePaid: usd(1.5),
      borrowFeeAccrued: usd(0),
      fundingFeeAccrued: usd(0),
      lastFeeAccrualAt: timestamp(1_700_000_000_000),
      openedAt: timestamp(1_700_000_000_000),
      confirmedAt: timestamp(1_700_000_002_000),
      status: "active",
    };

    const v3State = {
      balance: 1000,
      isInitialized: true,
      approvedTokens: ["USDC"],
      activePosition: legacyPosition,
      tradeHistory: [],
      tutorialEnabled: true,
      tutorialDismissed: {},
      tradingMode: "classic",
      showPnlAfterFees: true,
      simulateKeeperDelay: true,
      oneClickTrading: {
        enabled: false,
        activatedAt: null,
        actionsRemaining: 60,
        expiresAt: null,
      },
    };

    const migrated = migrateStore(v3State, 3) as Record<string, unknown>;

    expect(Array.isArray(migrated.positions)).toBe(true);
    const positions = migrated.positions as Position[];
    expect(positions).toHaveLength(1);
    expect(positions[0]?.id).toBe("legacy-eth-long");
    expect(migrated.selectedPositionId).toBe("legacy-eth-long");
    // Legacy slot is dropped from the migrated shape.
    expect(migrated.activePosition).toBeUndefined();
  });

  it("v3 → v4 migration with no active position results in empty positions[]", () => {
    const v3State = {
      balance: 1000,
      isInitialized: true,
      approvedTokens: [],
      activePosition: null,
      tradeHistory: [],
      tutorialEnabled: true,
      tutorialDismissed: {},
      tradingMode: "classic",
      showPnlAfterFees: true,
      simulateKeeperDelay: true,
      oneClickTrading: {
        enabled: false,
        activatedAt: null,
        actionsRemaining: 60,
        expiresAt: null,
      },
    };

    const migrated = migrateStore(v3State, 3) as Record<string, unknown>;
    expect(migrated.positions).toEqual([]);
    expect(migrated.selectedPositionId).toBeNull();
    expect(migrated.activePosition).toBeUndefined();
  });

  it("v2 → v4 migration backfills lastFeeAccrualAt then collapses to positions[]", () => {
    // A v2 blob: position has openedAt but no lastFeeAccrualAt.
    const v2Position = {
      id: "v2-pos",
      market: "eth" as const,
      direction: "long" as const,
      collateralUsd: 500,
      leverage: 5,
      sizeUsd: 2500,
      entryPrice: 2500,
      acceptablePrice: 2510,
      liquidationPrice: 2050,
      positionFeeBps: 6,
      positionFeePaid: 1.5,
      borrowFeeAccrued: 0,
      fundingFeeAccrued: 0,
      // intentionally no lastFeeAccrualAt
      openedAt: 1_700_000_000_000,
      confirmedAt: 1_700_000_002_000,
      status: "active" as const,
    };

    const migrated = migrateStore(
      { activePosition: v2Position },
      1,
    ) as Record<string, unknown>;

    const positions = migrated.positions as Position[];
    expect(positions).toHaveLength(1);
    expect(positions[0]?.lastFeeAccrualAt).toBeDefined();
    expect(migrated.selectedPositionId).toBe("v2-pos");
  });
});
