"use client";

import { usePaperStore } from "@/store/usePaperStore";
import {
  BALANCE_PRESETS,
  MAX_BALANCE,
  MIN_TRADE_AMOUNT,
} from "@/lib/constants";
import { formatUSD } from "@/lib/format";
import { useState } from "react";
import { motion } from "framer-motion";

export default function BalanceSelector() {
  const initializeBalance = usePaperStore((s) => s.initializeBalance);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState("");

  const handlePresetClick = (value: number) => {
    setSelectedPreset(value);
    setCustomAmount("");
    setError("");
  };

  const handleCustomChange = (value: string) => {
    setCustomAmount(value);
    setSelectedPreset(null);
    setError("");

    const num = parseFloat(value);
    if (value && (isNaN(num) || num < MIN_TRADE_AMOUNT)) {
      setError(`Minimum is ${formatUSD(MIN_TRADE_AMOUNT)}`);
    } else if (num > MAX_BALANCE) {
      setError(`Maximum is ${formatUSD(MAX_BALANCE)}`);
    }
  };

  const handleStart = () => {
    const amount = selectedPreset || parseFloat(customAmount);
    if (amount >= MIN_TRADE_AMOUNT && amount <= MAX_BALANCE) {
      initializeBalance(amount);
    }
  };

  const canStart =
    (selectedPreset !== null ||
      (customAmount &&
        !isNaN(parseFloat(customAmount)) &&
        parseFloat(customAmount) >= MIN_TRADE_AMOUNT &&
        parseFloat(customAmount) <= MAX_BALANCE)) &&
    !error;

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Preset Buttons */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {BALANCE_PRESETS.map((preset) => (
          <motion.button
            key={preset.value}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handlePresetClick(preset.value)}
            className={`relative rounded-xl border-2 p-4 text-center transition-colors ${
              selectedPreset === preset.value
                ? "border-blue-primary bg-blue-primary/10"
                : "border-border-primary bg-bg-card hover:border-border-hover"
            }`}
          >
            <p
              className={`text-lg font-bold ${
                selectedPreset === preset.value
                  ? "text-blue-primary"
                  : "text-text-primary"
              }`}
            >
              {preset.label}
            </p>
            <p className="mt-1 text-xs text-text-muted">USDC</p>
            {selectedPreset === preset.value && (
              <motion.div
                layoutId="balance-indicator"
                className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-blue-primary"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
          </motion.button>
        ))}
      </div>

      {/* Custom Amount Input */}
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-text-secondary">
          Or enter custom amount
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
            $
          </span>
          <input
            type="number"
            value={customAmount}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Enter amount..."
            min={MIN_TRADE_AMOUNT}
            max={MAX_BALANCE}
            className={`w-full rounded-xl border bg-bg-input py-3 pl-8 pr-16 text-text-primary placeholder-text-muted focus:outline-none ${
              error
                ? "border-red-primary"
                : customAmount
                  ? "border-blue-primary"
                  : "border-border-primary"
            } focus:border-blue-primary`}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">
            USDC
          </span>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-primary">{error}</p>}
      </div>

      {/* Start Trading Button */}
      <motion.button
        whileHover={canStart ? { scale: 1.01 } : {}}
        whileTap={canStart ? { scale: 0.99 } : {}}
        onClick={handleStart}
        disabled={!canStart}
        className={`w-full rounded-xl py-4 text-base font-bold transition-colors ${
          canStart
            ? "bg-blue-primary text-white hover:bg-blue-hover active:bg-blue-primary"
            : "bg-border-primary text-text-muted cursor-not-allowed"
        }`}
      >
        Start Trading
      </motion.button>

      {/* Info text */}
      <p className="mt-4 text-center text-xs text-text-muted leading-relaxed">
        Pick your starting balance. This is fake USDC for paper trading.
        <br />
        You can top up anytime in Settings.
      </p>
    </div>
  );
}
