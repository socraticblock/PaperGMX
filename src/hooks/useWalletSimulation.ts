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
  /** Whether USDC is already approved (skip approval popup) */
  isAlreadyApproved: boolean;
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

const APPROVAL_PROCESSING_MS = 1200; // Simulated on-chain approval tx
const APPROVAL_SUCCESS_MS = 600;     // Green checkmark display time
const SIGNING_PROCESSING_MS = 800;   // Simulated on-chain order tx
const SIGNING_SUCCESS_MS = 500;      // Green checkmark before keeper

// ─── Hook ────────────────────────────────────────────────

export function useWalletSimulation(): WalletSimulationResult {
  const { orderStatus, approvedTokens, approveToken, setOrderStatus } =
    usePaperStore(
      useShallow((s) => ({
        orderStatus: s.orderStatus,
        approvedTokens: s.approvedTokens,
        approveToken: s.approveToken,
        setOrderStatus: s.setOrderStatus,
      }))
    );

  const [processing, setProcessing] = useState<PopupProcessingState>("idle");

  // Track mount state so setTimeout callbacks don't set state after unmount
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isAlreadyApproved = approvedTokens.includes("USDC");

  const showApproval =
    orderStatus === "approving" || orderStatus === "approved";
  const showSigning = orderStatus === "signing";
  const isVisible = showApproval || showSigning;

  // ─── Approval flow ────────────────────────────────────

  const handleApprove = useCallback(() => {
    if (processing !== "idle") return; // Prevent double-click

    setProcessing("processing");
    setOrderStatus("approved"); // State machine: approving → approved

    // Simulate on-chain approval tx
    setTimeout(() => {
      if (!mountedRef.current) return;
      approveToken("USDC"); // Persist approval
      setProcessing("success"); // Show green checkmark

      // Brief success display, then auto-transition to signing
      setTimeout(() => {
        if (!mountedRef.current) return;
        setProcessing("idle");
        setOrderStatus("signing"); // approved → signing
      }, APPROVAL_SUCCESS_MS);
    }, APPROVAL_PROCESSING_MS);
  }, [processing, approveToken, setOrderStatus]);

  const handleRejectApproval = useCallback(() => {
    // User rejected — no on-chain action happened, go back to idle
    setProcessing("idle");
    setOrderStatus("idle"); // approving → idle (valid per state machine)
  }, [setOrderStatus]);

  // ─── Signing flow ─────────────────────────────────────

  const handleConfirm = useCallback(() => {
    if (processing !== "idle") return;

    setProcessing("processing");
    setOrderStatus("submitted"); // signing → submitted

    // Brief success animation, then SubmitOrderButton picks up
    // keeper steps via useEffect watching orderStatus === "submitted"
    setTimeout(() => {
      if (!mountedRef.current) return;
      setProcessing("success");

      setTimeout(() => {
        if (!mountedRef.current) return;
        setProcessing("idle");
        // Note: we do NOT set orderStatus here — the SubmitOrderButton's
        // useEffect takes over from "submitted" and drives keeper steps.
      }, SIGNING_SUCCESS_MS);
    }, SIGNING_PROCESSING_MS);
  }, [processing, setOrderStatus]);

  const handleRejectSigning = useCallback(() => {
    // User rejected signing — no on-chain action, go back to idle
    setProcessing("idle");
    setOrderStatus("idle"); // signing → idle
  }, [setOrderStatus]);

  return {
    isVisible,
    showApproval,
    showSigning,
    processing,
    isAlreadyApproved,
    handleApprove,
    handleRejectApproval,
    handleConfirm,
    handleRejectSigning,
  };
}
