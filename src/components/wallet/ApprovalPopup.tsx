"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import type { PopupProcessingState } from "@/hooks/useWalletSimulation";
import { GMX_CONTRACTS, FAKE_WALLET_ADDRESS } from "@/lib/constants";
import { DetailRow, shortenAddress } from "./shared";

// ─── Props ───────────────────────────────────────────────

interface ApprovalPopupProps {
  processing: PopupProcessingState;
  onApprove: () => void;
  onReject: () => void;
}

// ─── Component ───────────────────────────────────────────

function ApprovalPopupInner({
  processing,
  onApprove,
  onReject,
}: ApprovalPopupProps) {
  const isIdle = processing === "idle";
  const isProcessing = processing === "processing";
  const isSuccess = processing === "success";

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-primary/20">
          <svg
            className="h-4 w-4 text-blue-primary"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Approve USDC
          </h2>
          <p className="text-xs text-text-muted">{FAKE_WALLET_ADDRESS}</p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-3">
        <DetailRow
          label="Spender"
          value={shortenAddress(GMX_CONTRACTS.syntheticsRouter)}
        />
        <DetailRow label="Token" value="USDC" />
        <DetailRow label="Amount" value="Unlimited" highlight />
        <DetailRow label="Est. Gas" value="~$0.42" />
      </div>

      {/* Disclaimer */}
      <div className="mx-5 mb-4 rounded-lg bg-bg-input px-3 py-2">
        <p className="text-[10px] text-text-muted leading-relaxed text-center">
          Granting permission allows the GMX Router to spend your USDC. This is
          a simulation — no real transaction is created.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 px-5 pb-5">
        {isIdle && (
          <>
            <button
              onClick={onReject}
              className="flex-1 rounded-xl border border-border-primary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-input"
            >
              Reject
            </button>
            <button
              onClick={onApprove}
              className="flex-1 rounded-xl bg-blue-primary py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Approve
            </button>
          </>
        )}

        {isProcessing && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-primary/20 py-3">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-primary/30 border-t-blue-primary" />
            <span className="text-sm font-medium text-blue-primary">
              Processing...
            </span>
          </div>
        )}

        {isSuccess && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-primary/20 py-3">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="text-lg text-green-primary"
              aria-hidden="true"
            >
              ✓
            </motion.span>
            <span className="text-sm font-bold text-green-primary">
              Approved!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const ApprovalPopup = memo(ApprovalPopupInner);
export default ApprovalPopup;
