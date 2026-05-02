"use client";

import { memo, useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import {
  XMarkIcon,
  ArrowPathIcon,
  BoltIcon,
  BookOpenIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline";
import { formatBalance, formatUSD } from "@/lib/format";
import { BALANCE_PRESETS, ONE_CLICK_MAX_ACTIONS } from "@/lib/constants";
import { sanitizeNumericInput } from "@/lib/validation";
import { motion, AnimatePresence } from "framer-motion";
import { OneClickSetupModal } from "@/components/trade/OneClickSetupModal";
import ShareTradeSummaryButton from "@/components/trade/ShareTradeSummaryButton";

function SettingsPanelInner() {
  const {
    settingsOpen,
    setSettingsOpen,
    balance,
    topUpBalance,
    resetWallet,
    tutorialEnabled,
    setTutorialEnabled,
    tradingMode,
    setTradingMode,
    showPnlAfterFees,
    setShowPnlAfterFees,
    simulateKeeperDelay,
    setSimulateKeeperDelay,
    oneClickTrading,
    tradeHistory,
  } = usePaperStore(
    useShallow((s) => ({
      settingsOpen: s.settingsOpen,
      setSettingsOpen: s.setSettingsOpen,
      balance: s.balance,
      topUpBalance: s.topUpBalance,
      resetWallet: s.resetWallet,
      tutorialEnabled: s.tutorialEnabled,
      setTutorialEnabled: s.setTutorialEnabled,
      tradingMode: s.tradingMode,
      setTradingMode: s.setTradingMode,
      showPnlAfterFees: s.showPnlAfterFees,
      setShowPnlAfterFees: s.setShowPnlAfterFees,
      simulateKeeperDelay: s.simulateKeeperDelay,
      setSimulateKeeperDelay: s.setSimulateKeeperDelay,
      oneClickTrading: s.oneClickTrading,
      tradeHistory: s.tradeHistory,
    })),
  );

  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpError, setTopUpError] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showOneClickModal, setShowOneClickModal] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Memoize recent trades to avoid re-creating array on every render
  const recentTrades = useMemo(() => tradeHistory.slice(0, 10), [tradeHistory]);

  // Focus trap: focus the panel when it opens, restore when it closes
  useEffect(() => {
    if (settingsOpen) {
      panelRef.current?.focus();
    }
  }, [settingsOpen]);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        setSettingsOpen(false);
      }
    },
    [setSettingsOpen],
  );

  const handleTopUp = () => {
    setTopUpError("");
    const amount = sanitizeNumericInput(topUpAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setTopUpError("Enter a valid positive amount");
      return;
    }
    try {
      topUpBalance(amount);
      setTopUpAmount("");
    } catch (err) {
      setTopUpError(err instanceof Error ? err.message : "Invalid amount");
    }
  };

  const handleReset = () => {
    resetWallet();
    setSettingsOpen(false);
    setShowResetConfirm(false);
  };

  return (
    <>
      <AnimatePresence>
        {settingsOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setSettingsOpen(false)}
              aria-hidden="true"
            />

            {/* Panel */}
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
              tabIndex={-1}
              onKeyDown={handleKeyDown}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border-primary bg-bg-primary outline-none"
            >
              {/* Panel Header */}
              <div className="flex items-center justify-between border-b border-border-primary px-6 py-4">
                <h2
                  id="settings-title"
                  className="text-lg font-bold text-text-primary"
                >
                  Settings
                </h2>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary hover:text-text-primary"
                  aria-label="Close settings"
                >
                  <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Panel Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6">
                  {/* ─── Balance Section ───────────────── */}
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      <InformationCircleIcon
                        className="h-4 w-4"
                        aria-hidden="true"
                      />
                      Balance
                    </h3>
                    <div className="rounded-xl border border-border-primary bg-bg-card p-4">
                      <p
                        className="text-2xl font-bold text-text-primary"
                        aria-live="polite"
                      >
                        {formatBalance(balance)}
                      </p>

                      <div className="mt-3 flex gap-2">
                        <div className="flex-1">
                          <input
                            id="topup-amount"
                            type="number"
                            value={topUpAmount}
                            onChange={(e) => {
                              setTopUpAmount(e.target.value);
                              setTopUpError("");
                            }}
                            onKeyDown={(e) => {
                              // Block 'e', 'E', '+', '-' which type=number allows but are invalid for USD amounts
                              if (["e", "E", "+", "-"].includes(e.key)) {
                                e.preventDefault();
                              }
                            }}
                            min="1"
                            placeholder="Amount..."
                            aria-label="Top-up amount in USDC"
                            aria-invalid={!!topUpError}
                            className={`w-full rounded-lg border bg-bg-input px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none ${
                              topUpError
                                ? "border-red-primary focus:border-red-primary"
                                : "border-border-primary focus:border-blue-primary"
                            }`}
                          />
                          {topUpError && (
                            <p className="mt-1 text-xs text-red-primary" role="alert">
                              {topUpError}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={handleTopUp}
                          className="rounded-lg bg-blue-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-hover"
                        >
                          Top Up
                        </button>
                      </div>

                      <div className="mt-2 flex gap-2">
                        {BALANCE_PRESETS.map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => {
                              topUpBalance(preset.value);
                              setTopUpAmount("");
                            }}
                            className="flex-1 rounded-lg border border-border-primary bg-bg-input px-2 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-blue-primary hover:text-blue-primary"
                          >
                            +{preset.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* ─── Trading Mode ──────────────────── */}
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      <BoltIcon className="h-4 w-4" aria-hidden="true" />
                      Trading Mode
                    </h3>
                    <div
                      className="flex gap-2"
                      role="radiogroup"
                      aria-label="Trading mode"
                    >
                      <button
                        role="radio"
                        aria-checked={tradingMode === "classic"}
                        onClick={() => setTradingMode("classic")}
                        className={`flex-1 rounded-xl border p-3 text-center transition-colors ${
                          tradingMode === "classic"
                            ? "border-blue-primary bg-blue-primary/10 text-blue-primary"
                            : "border-border-primary bg-bg-card text-text-secondary hover:border-border-hover"
                        }`}
                      >
                        <p className="text-sm font-semibold">Classic</p>
                        <p className="mt-1 text-xs opacity-70">
                          Full wallet flow
                        </p>
                      </button>
                      <button
                        role="radio"
                        aria-checked={tradingMode === "1ct"}
                        onClick={() => setTradingMode("1ct")}
                        className={`flex-1 rounded-xl border p-3 text-center transition-colors ${
                          tradingMode === "1ct"
                            ? "border-purple-primary bg-purple-primary/10 text-purple-primary"
                            : "border-border-primary bg-bg-card text-text-secondary hover:border-border-hover"
                        }`}
                      >
                        <p className="text-sm font-semibold">One-Click ⚡</p>
                        <p className="mt-1 text-xs opacity-70">
                          {oneClickTrading.enabled
                            ? `${oneClickTrading.actionsRemaining}/${ONE_CLICK_MAX_ACTIONS} actions`
                            : "Gasless trades"}
                        </p>
                      </button>
                    </div>
                  </section>

                  {/* ─── One-Click Trading ────────────────── */}
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      <BoltIcon className="h-4 w-4" aria-hidden="true" />
                      One-Click Trading
                    </h3>
                    <div className="rounded-xl border border-border-primary bg-bg-card p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-text-primary">
                            1CT Mode
                          </p>
                          <p className="text-xs text-text-muted">
                            {oneClickTrading.enabled
                              ? `${oneClickTrading.actionsRemaining}/${ONE_CLICK_MAX_ACTIONS} actions remaining`
                              : "Skip wallet approvals for faster trading"}
                          </p>
                        </div>
                        <button
                          onClick={() => setShowOneClickModal(true)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                            oneClickTrading.enabled
                              ? "bg-purple-primary/10 text-purple-primary hover:bg-purple-primary/20"
                              : "bg-purple-primary text-white hover:bg-purple-primary/90"
                          }`}
                        >
                          {oneClickTrading.enabled ? "Manage" : "Setup"}
                        </button>
                      </div>
                      {oneClickTrading.enabled && (
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-bg-input">
                          <div
                            className="h-full rounded-full bg-purple-primary transition-all"
                            style={{
                              width: `${(oneClickTrading.actionsRemaining / ONE_CLICK_MAX_ACTIONS) * 100}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ─── Preferences ────────────────────── */}
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      <BookOpenIcon className="h-4 w-4" aria-hidden="true" />
                      Preferences
                    </h3>
                    <div className="space-y-3 rounded-xl border border-border-primary bg-bg-card p-4">
                      {/* Tutorial Toggle */}
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="toggle-tutorial"
                          className="cursor-pointer"
                        >
                          <p className="text-sm font-medium text-text-primary">
                            Tutorial Mode
                          </p>
                          <p className="text-xs text-text-muted">
                            Show helpful tooltips
                          </p>
                        </label>
                        <button
                          id="toggle-tutorial"
                          role="switch"
                          aria-checked={tutorialEnabled}
                          aria-label="Tutorial Mode"
                          onClick={() => setTutorialEnabled(!tutorialEnabled)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            tutorialEnabled
                              ? "bg-blue-primary"
                              : "bg-border-primary"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              tutorialEnabled
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {/* P&L After Fees Toggle */}
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="toggle-pnl-fees"
                          className="cursor-pointer"
                        >
                          <p className="text-sm font-medium text-text-primary">
                            P&L After Fees
                          </p>
                          <p className="text-xs text-text-muted">
                            Show net profit including fees
                          </p>
                        </label>
                        <button
                          id="toggle-pnl-fees"
                          role="switch"
                          aria-checked={showPnlAfterFees}
                          aria-label="Show P&L after fees"
                          onClick={() => setShowPnlAfterFees(!showPnlAfterFees)}
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            showPnlAfterFees
                              ? "bg-blue-primary"
                              : "bg-border-primary"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              showPnlAfterFees
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Keeper Delay Toggle */}
                      <div className="flex items-center justify-between">
                        <label
                          htmlFor="toggle-keeper-delay"
                          className="cursor-pointer"
                        >
                          <p className="text-sm font-medium text-text-primary">
                            Keeper Delay
                          </p>
                          <p className="text-xs text-text-muted">
                            Simulate 2-8s execution delay
                          </p>
                        </label>
                        <button
                          id="toggle-keeper-delay"
                          role="switch"
                          aria-checked={simulateKeeperDelay}
                          aria-label="Simulate keeper delay"
                          onClick={() =>
                            setSimulateKeeperDelay(!simulateKeeperDelay)
                          }
                          className={`relative h-6 w-11 rounded-full transition-colors ${
                            simulateKeeperDelay
                              ? "bg-blue-primary"
                              : "bg-border-primary"
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                              simulateKeeperDelay
                                ? "translate-x-5"
                                : "translate-x-0.5"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </section>

                  {/* ─── Trade History ──────────────────── */}
                  <section>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-text-secondary uppercase tracking-wider">
                      <ArrowPathIcon className="h-4 w-4" aria-hidden="true" />
                      Trade History ({tradeHistory.length})
                    </h3>
                    {recentTrades.length === 0 ? (
                      <div className="rounded-xl border border-border-primary bg-bg-card p-4 text-center">
                        <p className="text-sm text-text-muted">
                          No trades yet. Make your first trade!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {recentTrades.map((trade) => (
                          <div
                            key={trade.id}
                            className="flex items-center justify-between gap-2 rounded-lg border border-border-primary bg-bg-card p-3"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-text-primary">
                                {trade.leverage}x{" "}
                                {trade.direction === "long" ? "Long" : "Short"}{" "}
                                {trade.market.toUpperCase()}
                              </p>
                              <p className="text-xs text-text-muted">
                                {new Date(trade.closedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span
                                className={`text-sm font-semibold tabular-nums ${
                                  trade.netPnl >= 0
                                    ? "text-green-primary"
                                    : "text-red-primary"
                                }`}
                              >
                                {trade.netPnl >= 0 ? "+" : ""}
                                {formatUSD(trade.netPnl)}
                              </span>
                              <ShareTradeSummaryButton trade={trade} compact />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  {/* ─── Danger Zone ────────────────────── */}
                  <section>
                    <h3 className="mb-3 text-sm font-semibold text-red-primary uppercase tracking-wider">
                      Danger Zone
                    </h3>
                    {!showResetConfirm ? (
                      <button
                        onClick={() => setShowResetConfirm(true)}
                        className="w-full rounded-xl border border-red-primary/30 bg-red-bg p-3 text-sm font-medium text-red-primary transition-colors hover:border-red-primary hover:bg-red-primary/20"
                      >
                        Reset & Start Over
                      </button>
                    ) : (
                      <div
                        className="rounded-xl border border-red-primary bg-red-bg p-4"
                        role="alertdialog"
                        aria-label="Confirm reset"
                      >
                        <p className="mb-3 text-sm text-red-primary">
                          This will erase all data and return to the landing
                          page. Are you sure?
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setShowResetConfirm(false)}
                            className="flex-1 rounded-lg border border-border-primary bg-bg-card px-3 py-2 text-sm text-text-secondary"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleReset}
                            className="flex-1 rounded-lg bg-red-primary px-3 py-2 text-sm font-medium text-white"
                          >
                            Yes, Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ─── About ──────────────────────────── */}
                  <section className="pb-6">
                    <div className="rounded-xl border border-border-primary bg-bg-card p-4">
                      <p className="text-xs text-text-muted leading-relaxed">
                        PaperGMX is a paper trading simulator for GMX V2
                        perpetual futures. It uses real market prices and fee
                        structures but fake money. No wallet, no crypto, no
                        risk. This is a simulation for educational purposes
                        only.
                      </p>
                      <a
                        href="https://app.gmx.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-block text-xs font-medium text-blue-primary hover:underline"
                      >
                        Switch to Real GMX →
                      </a>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* One-Click Trading Modal — rendered outside the panel so it works even when panel is closed */}
      <OneClickSetupModal
        open={showOneClickModal}
        onClose={() => setShowOneClickModal(false)}
      />
    </>
  );
}

export const SettingsPanel = memo(SettingsPanelInner);
export default SettingsPanel;
