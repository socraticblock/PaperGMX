import { describe, it, expect, beforeEach, vi } from "vitest";
import { usePaperStore } from "@/store/usePaperStore";

// ─── Test the wallet simulation flow via the store ────────
// The hook uses Zustand store, so we test the integration
// by driving store state and checking transitions.

describe("Wallet Simulation Flow", () => {
  beforeEach(() => {
    // Reset store to clean state
    usePaperStore.setState({
      balance: 10000,
      isInitialized: true,
      approvedTokens: [],
      activePosition: null,
      orderStatus: "idle",
      tradeHistory: [],
    });
  });

  // ─── State Machine Tests ───────────────────────────────

  describe("State Machine Transitions", () => {
    it("allows idle → approving", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");
    });

    it("allows idle → signing (already approved)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");
    });

    it("allows approving → idle (wallet rejection)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows signing → idle (wallet rejection)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("signing");
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("allows approving → approved → signing → submitted", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");

      store.setOrderStatus("approved");
      expect(usePaperStore.getState().orderStatus).toBe("approved");

      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");

      store.setOrderStatus("submitted");
      expect(usePaperStore.getState().orderStatus).toBe("submitted");
    });

    it("rejects invalid transition: idle → approved", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approved"); // Should be rejected
      expect(usePaperStore.getState().orderStatus).toBe("idle"); // Stays idle
    });

    it("rejects invalid transition: idle → submitted", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("submitted"); // Should be rejected
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });
  });

  // ─── Approval Persistence Tests ────────────────────────

  describe("Approval Persistence", () => {
    it("adds USDC to approvedTokens when approved", () => {
      const store = usePaperStore.getState();
      expect(store.approvedTokens).not.toContain("USDC");

      store.approveToken("USDC");
      expect(usePaperStore.getState().approvedTokens).toContain("USDC");
    });

    it("does not duplicate USDC in approvedTokens", () => {
      const store = usePaperStore.getState();
      store.approveToken("USDC");
      store.approveToken("USDC");
      expect(
        usePaperStore.getState().approvedTokens.filter((t) => t === "USDC")
      ).toHaveLength(1);
    });

    it("needsApproval is true when USDC not in approvedTokens", () => {
      const store = usePaperStore.getState();
      expect(store.approvedTokens.includes("USDC")).toBe(false);
    });

    it("needsApproval is false after USDC is approved", () => {
      const store = usePaperStore.getState();
      store.approveToken("USDC");
      expect(usePaperStore.getState().approvedTokens.includes("USDC")).toBe(
        true
      );
    });
  });

  // ─── Full Flow Test ────────────────────────────────────

  describe("Full Wallet Flow", () => {
    it("completes: idle → approving → approved → signing → submitted → keeper → filled", () => {
      const store = usePaperStore.getState();

      // Step 1: Start approval
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");

      // Step 2: User approves
      store.setOrderStatus("approved");
      store.approveToken("USDC");
      expect(usePaperStore.getState().orderStatus).toBe("approved");
      expect(usePaperStore.getState().approvedTokens).toContain("USDC");

      // Step 3: Auto-transition to signing
      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");

      // Step 4: User confirms signing
      store.setOrderStatus("submitted");
      expect(usePaperStore.getState().orderStatus).toBe("submitted");

      // Step 5: Keeper steps
      store.setOrderStatus("keeper_step_1");
      store.setOrderStatus("keeper_step_2");
      store.setOrderStatus("keeper_step_3");
      store.setOrderStatus("keeper_step_4");
      expect(usePaperStore.getState().orderStatus).toBe("keeper_step_4");

      // Step 6: Filled
      store.setOrderStatus("filled");
      expect(usePaperStore.getState().orderStatus).toBe("filled");
    });

    it("skips approval when already approved: idle → signing → submitted", () => {
      const store = usePaperStore.getState();
      store.approveToken("USDC");

      // Since USDC is approved, go straight to signing
      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");

      store.setOrderStatus("submitted");
      expect(usePaperStore.getState().orderStatus).toBe("submitted");
    });

    it("allows retry after rejection: idle → approving → idle → approving", () => {
      const store = usePaperStore.getState();

      // First attempt
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");

      // User rejects
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");

      // Retry
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");
    });

    it("allows retry after signing rejection: idle → signing → idle → signing", () => {
      const store = usePaperStore.getState();
      store.approveToken("USDC"); // Already approved

      // First signing attempt
      store.setOrderStatus("signing");
      store.setOrderStatus("idle"); // Reject
      expect(usePaperStore.getState().orderStatus).toBe("idle");

      // Retry signing
      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");
    });
  });
});
