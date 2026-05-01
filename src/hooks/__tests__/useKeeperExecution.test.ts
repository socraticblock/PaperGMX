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
      activePosition: null,
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

    it("blocks cancel at keeper_step_3 (too late)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("cancelled"); // Should be blocked
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_3");
    });

    it("blocks cancel at keeper_step_4 (too late)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("cancelled"); // Should be blocked
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_4");
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
      usePaperStore.getState().setActivePosition(makeTestPosition());

      const pos = usePaperStore.getState().activePosition;
      expect(pos).not.toBeNull();
      expect(pos!.status).toBe("confirming");
      expect(pos!.confirmedAt).toBeNull();
    });

    it("position transitions from confirming to active", () => {
      usePaperStore.getState().setActivePosition(makeTestPosition());

      usePaperStore.setState({
        activePosition: {
          ...usePaperStore.getState().activePosition!,
          confirmedAt: timestamp(Date.now()),
          status: "active",
        },
      });

      const pos = usePaperStore.getState().activePosition;
      expect(pos!.status).toBe("active");
      expect(pos!.confirmedAt).not.toBeNull();
    });
  });
});
