import { describe, it, expect, beforeEach } from "vitest";
import { usePaperStore } from "@/store/usePaperStore";
import { usd, price, bps, timestamp } from "@/lib/branded";

// ─── Test the wallet simulation flow via the store ────────
// The hook uses Zustand store, so we test the integration
// by driving store state and checking transitions.

describe("Wallet Simulation Flow", () => {
  beforeEach(() => {
    // Reset store to clean state
    usePaperStore.setState({
      balance: usd(10000),
      isInitialized: true,
      approvedTokens: [],
      activePosition: null,
      orderStatus: "idle" as const,
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

    it("allows approving → cancelled (wallet rejection)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      store.setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
    });

    it("allows signing → cancelled (wallet rejection)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("signing");
      store.setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");
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

    it("blocks invalid transition: idle → approved", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approved"); // Should be blocked
      expect(usePaperStore.getState().orderStatus).toBe("idle"); // Stays idle
    });

    it("blocks invalid transition: idle → submitted", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("submitted"); // Should be blocked
      expect(usePaperStore.getState().orderStatus).toBe("idle");
    });

    it("blocks invalid transition: approving → signing (must go through approved first)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      store.setOrderStatus("signing"); // Should be blocked
      expect(usePaperStore.getState().orderStatus).toBe("approving");
    });

    it("allows cancelled → idle (reset after rejection)", () => {
      const store = usePaperStore.getState();
      store.setOrderStatus("approving");
      store.setOrderStatus("cancelled");
      store.setOrderStatus("idle");
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
        usePaperStore.getState().approvedTokens.filter((t) => t === "USDC"),
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
        true,
      );
    });
  });

  // ─── lockCollateral Tests ─────────────────────────────────

  describe("lockCollateral", () => {
    it("deducts collateral from balance", () => {
      usePaperStore.setState({ balance: usd(10000) });
      usePaperStore.getState().lockCollateral(usd(1000));
      expect(usePaperStore.getState().balance).toBe(9000);
    });

    it("does not deduct if amount exceeds balance", () => {
      usePaperStore.setState({ balance: usd(500) });
      usePaperStore.getState().lockCollateral(usd(1000));
      expect(usePaperStore.getState().balance).toBe(500); // Unchanged
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

    it("allows retry after rejection: idle → approving → cancelled → idle → approving", () => {
      const store = usePaperStore.getState();

      // First attempt
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");

      // User rejects
      store.setOrderStatus("cancelled");
      expect(usePaperStore.getState().orderStatus).toBe("cancelled");

      // Reset to idle
      store.setOrderStatus("idle");

      // Retry
      store.setOrderStatus("approving");
      expect(usePaperStore.getState().orderStatus).toBe("approving");
    });

    it("allows retry after signing rejection: idle → signing → cancelled → idle → signing", () => {
      const store = usePaperStore.getState();
      store.approveToken("USDC"); // Already approved

      // First signing attempt
      store.setOrderStatus("signing");
      store.setOrderStatus("cancelled"); // Reject
      store.setOrderStatus("idle");
      expect(usePaperStore.getState().orderStatus).toBe("idle");

      // Retry signing
      store.setOrderStatus("signing");
      expect(usePaperStore.getState().orderStatus).toBe("signing");
    });
  });
});
