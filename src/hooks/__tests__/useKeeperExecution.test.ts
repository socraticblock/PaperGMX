import { describe, it, expect, beforeEach } from "vitest";
import { usePaperStore } from "@/store/usePaperStore";

// ─── Helper: walk through wallet flow to reach "submitted" ──
function reachSubmitted() {
  const store = usePaperStore.getState();
  // Walk the full path: idle → signing → submitted
  store.setOrderStatus("signing");
  store.setOrderStatus("submitted");
  return usePaperStore.getState().orderStatus;
}

describe("Keeper Execution Flow", () => {
  beforeEach(() => {
    usePaperStore.setState({
      balance: 10000,
      isInitialized: true,
      approvedTokens: ["USDC"], // Already approved
      activePosition: null,
      orderStatus: "idle",
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

    it("allows keeper_step_4 → failed", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("failed");
      expect(usePaperStore.getState().orderStatus).toBe("failed");
    });
  });

  // ─── Cancel during keeper steps ───────────────────────

  describe("Cancel During Keeper", () => {
    it("allows submitted → idle (cancel before keeper starts)", () => {
      reachSubmitted();
      usePaperStore.getState().setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows keeper_step_1 → idle (cancel during step 1)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows keeper_step_2 → idle (cancel during step 2)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("rejects cancel at keeper_step_3 (too late)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("idle"); // Should be rejected
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_3");
    });

    it("rejects cancel at keeper_step_4 (too late)", () => {
      reachSubmitted();
      const store = usePaperStore.getState();
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      store.setOrderStatus("idle"); // Should be rejected
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
      usePaperStore.getState().setActivePosition({
        id: "eth-long-123",
        market: "eth",
        direction: "long",
        collateralUsd: 1000,
        leverage: 5,
        sizeUsd: 5000,
        entryPrice: 3000,
        acceptablePrice: 3015,
        liquidationPrice: 2410,
        positionFeeBps: 6,
        positionFeePaid: 3,
        borrowFeeAccrued: 0,
        fundingFeeAccrued: 0,
        openedAt: Date.now(),
        confirmedAt: null,
        status: "confirming",
      });

      const pos = usePaperStore.getState().activePosition;
      expect(pos).not.toBeNull();
      expect(pos!.status).toBe("confirming");
      expect(pos!.confirmedAt).toBeNull();
    });

    it("position transitions from confirming to active", () => {
      usePaperStore.getState().setActivePosition({
        id: "eth-long-123",
        market: "eth",
        direction: "long",
        collateralUsd: 1000,
        leverage: 5,
        sizeUsd: 5000,
        entryPrice: 3000,
        acceptablePrice: 3015,
        liquidationPrice: 2410,
        positionFeeBps: 6,
        positionFeePaid: 3,
        borrowFeeAccrued: 0,
        fundingFeeAccrued: 0,
        openedAt: Date.now(),
        confirmedAt: null,
        status: "confirming",
      });

      usePaperStore.setState({
        activePosition: {
          ...usePaperStore.getState().activePosition!,
          confirmedAt: Date.now(),
          status: "active",
        },
      });

      const pos = usePaperStore.getState().activePosition;
      expect(pos!.status).toBe("active");
      expect(pos!.confirmedAt).not.toBeNull();
    });
  });
});
