"use client";

import { memo, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import {
  XMarkIcon,
  BoltIcon,
  ShieldCheckIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import {
  ONE_CLICK_MAX_ACTIONS,
  ONE_CLICK_DURATION_DAYS,
  ONE_CLICK_WARNING_THRESHOLD,
} from "@/lib/constants";
// ─── Types ────────────────────────────────────────────────

export interface OneClickSetupModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Timer Hook ───────────────────────────────────────────

function useExpiryCountdown(expiresAt: number | null): string {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) {
      return;
    }

    function compute() {
      const diff = expiresAt! - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      if (days > 0) {
        setRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setRemaining(`${hours}h ${minutes}m`);
      } else {
        setRemaining(`${minutes}m`);
      }
    }

    compute();
    const interval = setInterval(compute, 60_000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return remaining;
}

// ─── Component ────────────────────────────────────────────

function OneClickSetupModalInner({ open, onClose }: OneClickSetupModalProps) {
  const {
    oneClickTrading,
    enableOneClickTrading,
    disableOneClickTrading,
    renewOneClickTrading,
  } = usePaperStore(
    useShallow((s) => ({
      oneClickTrading: s.oneClickTrading,
      enableOneClickTrading: s.enableOneClickTrading,
      disableOneClickTrading: s.disableOneClickTrading,
      renewOneClickTrading: s.renewOneClickTrading,
    }))
  );

  const [confirming, setConfirming] = useState(false);
  const [processing, setProcessing] = useState(false);

  const countdown = useExpiryCountdown(oneClickTrading.expiresAt as number | null);

  // Track current time in state to avoid calling Date.now() during render
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isExpired =
    oneClickTrading.expiresAt !== null &&
    oneClickTrading.expiresAt < now;

  const isDepleted = oneClickTrading.actionsRemaining <= 0;
  const needsRenewal = oneClickTrading.enabled && (isExpired || isDepleted);
  const isLow = oneClickTrading.actionsRemaining <= ONE_CLICK_WARNING_THRESHOLD;

  // Determine if we should show the "enabled" view or the "setup" view
  const showEnabledView = oneClickTrading.enabled && !needsRenewal;

  const handleEnable = useCallback(() => {
    setProcessing(true);
    // Simulate a brief "signing" delay like real 1CT setup
    setTimeout(() => {
      enableOneClickTrading();
      setProcessing(false);
      setConfirming(false);
    }, 800);
  }, [enableOneClickTrading]);

  const handleDisable = useCallback(() => {
    disableOneClickTrading();
    onClose();
  }, [disableOneClickTrading, onClose]);

  const handleRenew = useCallback(() => {
    setProcessing(true);
    setTimeout(() => {
      renewOneClickTrading();
      setProcessing(false);
    }, 800);
  }, [renewOneClickTrading]);

  // Escape key handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="1ct-modal-title"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border-primary bg-bg-card p-6 shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Header */}
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-primary/10">
                <BoltIcon className="h-5 w-5 text-purple-primary" aria-hidden="true" />
              </div>
              <div>
                <h2
                  id="1ct-modal-title"
                  className="text-lg font-bold text-text-primary"
                >
                  One-Click Trading
                </h2>
                <p className="text-xs text-text-muted">
                  Skip wallet approvals for faster trading
                </p>
              </div>
            </div>

            {showEnabledView ? (
              /* ─── Enabled State ──────────────────────── */
              <>
                {/* Status card */}
                <div className="mb-5 rounded-xl border border-green-primary/30 bg-green-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <ShieldCheckIcon
                      className="h-5 w-5 text-green-primary"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-green-primary">
                      Active
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-3">
                    {/* Actions remaining */}
                    <div className="rounded-lg bg-bg-card/50 p-3">
                      <p className="text-xs text-text-muted">Actions left</p>
                      <p
                        className={`text-lg font-bold ${
                          isLow ? "text-yellow-primary" : "text-text-primary"
                        }`}
                      >
                        {oneClickTrading.actionsRemaining}/{ONE_CLICK_MAX_ACTIONS}
                      </p>
                    </div>

                    {/* Time remaining */}
                    <div className="rounded-lg bg-bg-card/50 p-3">
                      <p className="text-xs text-text-muted">Time left</p>
                      <p className="text-lg font-bold text-text-primary">
                        {countdown || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Low actions warning */}
                  {isLow && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-yellow-primary/10 p-2.5">
                      <ExclamationTriangleIcon
                        className="h-4 w-4 flex-shrink-0 text-yellow-primary"
                        aria-hidden="true"
                      />
                      <p className="text-xs text-yellow-primary">
                        Running low on actions. Renew to get {ONE_CLICK_MAX_ACTIONS}{" "}
                        more.
                      </p>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <button
                    onClick={handleDisable}
                    className="flex-1 rounded-xl border border-border-primary bg-bg-input py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                  >
                    Disable 1CT
                  </button>
                  <button
                    onClick={handleRenew}
                    disabled={processing}
                    className="flex-1 rounded-xl bg-purple-primary py-3 text-sm font-bold text-white transition-colors hover:bg-purple-primary/90 disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Renewing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                        Renew
                      </span>
                    )}
                  </button>
                </div>
              </>
            ) : needsRenewal ? (
              /* ─── Expired / Depleted State ──────────── */
              <>
                <div className="mb-5 rounded-xl border border-yellow-primary/30 bg-yellow-primary/5 p-4">
                  <div className="flex items-center gap-2">
                    <ExclamationTriangleIcon
                      className="h-5 w-5 text-yellow-primary"
                      aria-hidden="true"
                    />
                    <span className="text-sm font-semibold text-yellow-primary">
                      {isExpired ? "Expired" : "Actions Depleted"}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-secondary">
                    {isExpired
                      ? `Your 1CT session has expired after ${ONE_CLICK_DURATION_DAYS} days. Renew to continue trading without wallet approvals.`
                      : `You've used all ${ONE_CLICK_MAX_ACTIONS} actions. Renew to get ${ONE_CLICK_MAX_ACTIONS} more.`}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDisable}
                    className="flex-1 rounded-xl border border-border-primary bg-bg-input py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                  >
                    Switch to Classic
                  </button>
                  <button
                    onClick={handleRenew}
                    disabled={processing}
                    className="flex-1 rounded-xl bg-purple-primary py-3 text-sm font-bold text-white transition-colors hover:bg-purple-primary/90 disabled:opacity-50"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        Renewing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-1.5">
                        <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                        Renew 1CT
                      </span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              /* ─── Setup State (not yet enabled) ──── */
              <>
                {!confirming ? (
                  <>
                    {/* Explanation */}
                    <div className="mb-5 space-y-3">
                      <p className="text-sm text-text-secondary leading-relaxed">
                        One-Click Trading lets you skip wallet approval popups for
                        faster order submission — just like GMX&apos;s Gelato Relay on
                        real Arbitrum.
                      </p>

                      <div className="space-y-2">
                        <div className="flex items-start gap-2.5">
                          <BoltIcon
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-primary"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-text-secondary">
                            <span className="font-medium text-text-primary">
                              Instant trades
                            </span>{" "}
                            — Skip the approve & sign popups. Go straight to keeper
                            execution.
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <ShieldCheckIcon
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-primary"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-text-secondary">
                            <span className="font-medium text-text-primary">
                              Limited actions
                            </span>{" "}
                            — {ONE_CLICK_MAX_ACTIONS} actions over{" "}
                            {ONE_CLICK_DURATION_DAYS} days. Prevents runaway bots.
                          </p>
                        </div>
                        <div className="flex items-start gap-2.5">
                          <ClockIcon
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-primary"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-text-secondary">
                            <span className="font-medium text-text-primary">
                              Auto-expires
                            </span>{" "}
                            — After {ONE_CLICK_DURATION_DAYS} days, you&apos;ll need to
                            renew. Actions reset on renewal.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Simulation disclaimer */}
                    <div className="mb-5 rounded-lg border border-border-primary bg-bg-input p-3">
                      <p className="text-xs text-text-muted leading-relaxed">
                        📝 This is a simulation. Real GMX uses a Gelato Relay smart
                        contract wallet. Here we just skip the approval popups to
                        demonstrate the UX difference.
                      </p>
                    </div>

                    <button
                      onClick={() => setConfirming(true)}
                      className="w-full rounded-xl bg-purple-primary py-3.5 text-sm font-bold text-white transition-colors hover:bg-purple-primary/90"
                    >
                      <span className="flex items-center justify-center gap-2">
                        <BoltIcon className="h-4 w-4" aria-hidden="true" />
                        Enable One-Click Trading
                      </span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Fake signing confirmation */}
                    <div className="mb-5 rounded-xl border border-blue-primary/30 bg-blue-primary/5 p-5 text-center">
                      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-blue-primary/30 bg-blue-primary/10">
                        <ShieldCheckIcon
                          className="h-6 w-6 text-blue-primary"
                          aria-hidden="true"
                        />
                      </div>
                      <p className="text-sm font-medium text-text-primary">
                        Create 1CT Subaccount?
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        This will authorize a relay subaccount to execute trades on
                        your behalf.
                      </p>
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => setConfirming(false)}
                        className="flex-1 rounded-xl border border-border-primary bg-bg-input py-3 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleEnable}
                        disabled={processing}
                        className="flex-1 rounded-xl bg-purple-primary py-3 text-sm font-bold text-white transition-colors hover:bg-purple-primary/90 disabled:opacity-50"
                      >
                        {processing ? (
                          <span className="flex items-center justify-center gap-2">
                            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                            Confirming...
                          </span>
                        ) : (
                          "Confirm"
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export const OneClickSetupModal = memo(OneClickSetupModalInner);
export default OneClickSetupModal;
