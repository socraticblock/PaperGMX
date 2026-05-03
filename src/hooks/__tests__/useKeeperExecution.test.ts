import { describe, it, expect, beforeEach } from "vitest";
import { usePaperStore } from "@/store/usePaperStore";
import { usd, price, bps, timestamp } from "@/lib/branded";
import type { Position } from "@/types";

// ─── Helper: walk through wallet flow to reach "submitted" ──
function reachSubmitted() {
  const store = usePaperStore.getState();
  // Walk the full path: idle → signing → submitted
  store.setOrderStatus("signing");
  store.setOrderStatus("submitted");
  return usePaperStore.getState().orderStatus;
}

// ─── Helper: create a test position ──────────────────────
function makeTestPosition(overrides?: Partial<Position>): Position {
  return {
    id: "eth-long-123",
    market: "eth",
    direction: "long",
    collateralUsd: usd(1000),
    leverage: 5,
    sizeUsd: usd(5000),
    entryPrice: price(3000),
    acceptablePrice: price(3015),
    liquidationPrice: price(2410),
    positionFeeBps: bps(6),
    positionFeePaid: usd(3),
    borrowFeeAccrued: usd(0),
    fundingFeeAccrued: usd(0),
    lastFeeAccrualAt: timestamp(Date.now()),
    openedAt: timestamp(Date.now()),
    confirmedAt: null,
    status: "confirming",
    ...overrides,
  };
}

describe("Keeper Execution Flow", () => {
  beforeEach(() => {
    usePaperStore.setState({
      balance: usd(10000),
      isInitialized: true,
      approvedTokens: ["USDC"], // Already approved
      positions: [],
      selectedPositionId: null,
      orderStatus: "idle" as const,
      tradeHistory: [],
    });
  });

  // ─── Keeper step transitions ───────────────────────────

  describe("Keeper Step Transitions", () => {
    it("allows submitted → keeper_step_1", () => {
      reachSubmitted();
      usePaperStore.getState().setOrderStatus("keeper_step_1");
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_1");
    });

    it("allows full keeper progression: submitted → step_1 → step_2 → step_3 → step_4", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_4");
    });

    it("allows keeper_step_4 → filled", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("filled");
      expect(usePaperStore.getState().orderStatus).toBe("filled");
    });

    it("allows keeper_step_4 → failed (keeper can report failure at final step)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("failed"); // Valid — keeper can fail at step 4
      expect(usePaperStore.getState().orderStatus).toBe("failed");
    });
  });

  // ─── Cancel during keeper steps ───────────────────────

  describe("Cancel During Keeper", () => {
    it("allows submitted → cancelled (cancel before keeper starts)", () => {
      reachSubmitted();
      usePaperStore.getState().setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });

    it("allows keeper_step_1 → cancelled (cancel during step 1)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });

    it("allows keeper_step_2 → cancelled (cancel during step 2)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });

    it("allows cancel at keeper_step_3 (slippage cancellation)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("cancelled"); // Now allowed — slippage can cancel at step 3
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });

    it("allows cancel at keeper_step_4 (slippage cancellation)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("cancelled"); // Now allowed — slippage can cancel at step 4
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });
  });

  // ─── Failure handling ─────────────────────────────────

  describe("Failure Handling", () => {
    it("allows submitted → failed", () => {
      reachSubmitted();
      usePaperStore.getState().setOrderStatus("failed");
      expect(usePaperStore.getState().orderStatus).toBe("failed");
    });

    it("allows failed → idle (retry after failure)", () => {
      reachSubmitted();
      usePaperStore.getState().setOrderStatus("failed");
      usePaperStore.getState().setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows keeper_step_1 → failed → idle (retry)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("failed");
      expect(usePaperStore.getState().orderStatus).toBe("failed");
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows keeper_step_2 → failed", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("failed");
      expect(usePaperStore.getState().orderStatus).toBe("failed");
    });
  });

  // ─── Position confirmation status ─────────────────────

  describe("Position Confirmation", () => {
    it("position starts with status 'confirming' and null confirmedAt", () => {
      const p = makeTestPosition();
      usePaperStore.getState().addPosition(p);

      const pos = usePaperStore
        .getState()
        .positions.find((x) => x.id === p.id);
      expect(pos).not.toBeUndefined();
      expect(pos!.status).toBe("confirming");
      expect(pos!.confirmedAt).toBeNull();
    });

    it("position transitions from confirming to active via updatePosition", () => {
      const p = makeTestPosition();
      usePaperStore.getState().addPosition(p);

      usePaperStore.getState().updatePosition(p.id, {
        confirmedAt: timestamp(Date.now()),
        status: "active",
      });

      const pos = usePaperStore
        .getState()
        .positions.find((x) => x.id === p.id);
      expect(pos!.status).toBe("active");
      expect(pos!.confirmedAt).not.toBeNull();
    });
  });

  // ─── Open vs Increase routing (multi-position model) ────────

  describe("Open vs Increase routing", () => {
    it("addPosition then second addPosition with same key would shadow — increasePosition merges instead", () => {
      const first = makeTestPosition({ id: "first" });
      usePaperStore.getState().addPosition(first);

      // Same (market, direction) — the keeper would route this through
      // increasePosition, NOT addPosition. We assert the merged shape here.
      usePaperStore.getState().increasePosition(first.id, {
        sizeDeltaUsd: usd(5000),
        collateralDeltaUsd: usd(1000),
        executionPrice: price(3500),
        openFeeUsd: usd(2),
        now: timestamp(Date.now()),
      });

      const positions = usePaperStore.getState().positions;
      expect(positions).toHaveLength(1);
      const merged = positions[0]!;
      expect(merged.id).toBe("first");
      expect(merged.sizeUsd).toBe(10000); // 5000 + 5000
    });

    it("opening different (market, side) keys yields multiple distinct positions", () => {
      const ethLong = makeTestPosition({ id: "eth-long", market: "eth" });
      const btcShort = makeTestPosition({
        id: "btc-short",
        market: "btc",
        direction: "short",
      });
      usePaperStore.getState().addPosition(ethLong);
      usePaperStore.getState().addPosition(btcShort);
      expect(usePaperStore.getState().positions).toHaveLength(2);
    });
  });
});
