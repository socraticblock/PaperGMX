"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";

// ─── Processing state within a popup ─────────────────────
// "idle" = showing Approve/Reject buttons
// "processing" = spinner after user clicks Approve/Confirm
// "success" = green checkmark before auto-dismiss

export type PopupProcessingState = "idle" | "processing" | "success";

// ─── Return type ─────────────────────────────────────────

export interface WalletSimulationResult {
  /** Whether any wallet popup is visible */
  isVisible: boolean;
  /** Whether to show the approval popup */
  showApproval: boolean;
  /** Whether to show the signing popup */
  showSigning: boolean;
  /** Processing state for the currently visible popup */
  processing: PopupProcessingState;
  /** Handle user clicking Approve in approval popup */
  handleApprove: () => void;
  /** Handle user clicking Reject in approval popup */
  handleRejectApproval: () => void;
  /** Handle user clicking Confirm in signing popup */
  handleConfirm: () => void;
  /** Handle user clicking Reject in signing popup */
  handleRejectSigning: () => void;
}

// ─── Timing constants ────────────────────────────────────

// Spec 4.8: spinner → success checkmark (1s total)
const APPROVAL_PROCESSING_MS = 700; // Spinner phase
const APPROVAL_SUCCESS_MS = 300; // Green checkmark phase
const SIGNING_PROCESSING_MS = 700; // Spinner phase
const SIGNING_SUCCESS_MS = 300; // Green checkmark phase

// ─── Hook ────────────────────────────────────────────────

export function useWalletSimulation(): WalletSimulationResult {
  const { orderStatus, approveToken, setOrderStatus } = usePaperStore(
    useShallow((s) => ({
      orderStatus: s.orderStatus,
      approveToken: s.approveToken,
      setOrderStatus: s.setOrderStatus,
    })),
  );

  const [processing, setProcessing] = useState<PopupProcessingState>("idle");

  // Ref-based processing guard to prevent double-clicks. React state is
  // captured in the closure at render time, so a rapid second click can
  // pass the `processing !== "idle"` check before the first click's
  // setProcessing("processing") causes a re-render. A ref is synchronous.
  const processingRef = useRef(false);

  // Track mount state so setTimeout callbacks don't set state after unmount
  const mountedRef = useRef(true);
  // Track timer IDs for cleanup on unmount
  const timerRefs = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    mountedRef.current = true;
    const timers = timerRefs.current;
    return () => {
      mountedRef.current = false;
      // Reset stuck wallet states on unmount.
      // If the user navigates away during approval/signing, the store
      // would be stuck in "approving"/"approved"/"signing" with no
      // running timeout to advance it. Reset to idle so the form works
      // when the user returns.
      //
      // We must use direct setState (bypassing the state machine) because
      // some mid-flow states like "approved" have no valid transition to
      // "idle" — the state machine would block the reset and leave the
      // store stuck forever.
      const status = usePaperStore.getState().orderStatus;
      if (
        status === "approving" ||
        status === "approved" ||
        status === "signing"
      ) {
        usePaperStore.setState(
          { orderStatus: "idle" as import("@/types").OrderStatus },
          false,
          "useWalletSimulation/unmount-cleanup",
        );
      }
      // Clean up all pending timers
      for (const id of timers) {
        clearTimeout(id);
      }
      timers.clear();
    };
  }, []);

  // Helper: schedule a timeout that's tracked for cleanup
  const scheduleTimeout = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(() => {
      timerRefs.current.delete(id);
      fn();
    }, delay);
    timerRefs.current.add(id);
    return id;
  }, []);

  const showApproval =
    orderStatus === "approving" || orderStatus === "approved";
  const showSigning = orderStatus === "signing";
  const isVisible = showApproval || showSigning;

  // ─── Approval flow ────────────────────────────────────

  const handleApprove = useCallback(() => {
    if (processingRef.current) return; // Prevent double-click (synchronous)
    processingRef.current = true;

    setProcessing("processing");
    // NOTE: We do NOT set orderStatus to "approved" yet.
    // The approval hasn't actually completed — we're still simulating
    // the on-chain tx. Setting "approved" prematurely means if the
    // component unmounts during the delay, the store is stuck in
    // "approved" with no way to continue.

    // Simulate on-chain approval tx
    scheduleTimeout(() => {
      if (!mountedRef.current) return;
      approveToken("USDC"); // Persist approval
      setProcessing("success"); // Show green checkmark
      setOrderStatus("approved"); // NOW the approval is confirmed

      // Brief success display, then auto-transition to signing
      scheduleTimeout(() => {
        if (!mountedRef.current) return;
        processingRef.current = false;
        setProcessing("idle");
        setOrderStatus("signing"); // approved → signing
      }, APPROVAL_SUCCESS_MS);
    }, APPROVAL_PROCESSING_MS);
  }, [processing, approveToken, setOrderStatus, scheduleTimeout]);

  const handleRejectApproval = useCallback(() => {
    // User rejected — no on-chain action happened, go back to idle
    processingRef.current = false;
    setProcessing("idle");
    setOrderStatus("cancelled"); // approving → cancelled
  }, [setOrderStatus]);

  // ─── Signing flow ─────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (processingRef.current) return; // Prevent double-click (synchronous)
    processingRef.current = true;

    setProcessing("processing");
    // NOTE: We do NOT set orderStatus to "submitted" yet.
    // The signing popup needs to show its success animation first.
    // Setting "submitted" immediately would dismiss the popup
    // (since isVisible only checks approving/approved/signing)
    // before the user sees the green checkmark.

    scheduleTimeout(() => {
      if (!mountedRef.current) return;
      setProcessing("success"); // Show green checkmark

      scheduleTimeout(() => {
        if (!mountedRef.current) return;
        processingRef.current = false;
        setProcessing("idle");
        // NOW transition to submitted — this triggers the keeper useEffect
        setOrderStatus("submitted"); // signing → submitted
      }, SIGNING_SUCCESS_MS);
    }, SIGNING_PROCESSING_MS);
  }, [processing, setOrderStatus, scheduleTimeout]);

  const handleRejectSigning = useCallback(() => {
    // User rejected signing — no on-chain action, go back to idle
    processingRef.current = false;
    setProcessing("idle");
    setOrderStatus("cancelled"); // signing → cancelled
  }, [setOrderStatus]);

  return {
    isVisible,
    showApproval,
    showSigning,
    processing,
    handleApprove,
    handleRejectApproval,
    handleConfirm,
    handleRejectSigning,
  };
}
