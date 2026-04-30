"use client";

import { memo, useCallback } from "react";
import type { USD } from "@/types";
import { usd } from "@/lib/branded";
import { formatUSD } from "@/lib/format";
import { MIN_TRADE_AMOUNT } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────

export interface CollateralInputProps {
  value: USD;
  balance: USD;
  onChange: (value: USD) => void;
  disabled?: boolean;
}

// ─── Percent Presets ──────────────────────────────────────

const PERCENT_PRESETS = [
  { label: "10%", fraction: 0.1 },
  { label: "25%", fraction: 0.25 },
  { label: "50%", fraction: 0.5 },
  { label: "100%", fraction: 1.0 },
] as const;

// ─── Component ────────────────────────────────────────────

function CollateralInputInner({
  value,
  balance,
  onChange,
  disabled = false,
}: CollateralInputProps) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === "" || raw === ".") {
        onChange(usd(0));
        return;
      }
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onChange(usd(Math.min(parsed, balance)));
      }
    },
    [onChange, balance]
  );

  const handlePercentClick = useCallback(
    (fraction: number) => {
      onChange(usd(Math.floor(balance * fraction * 100) / 100));
    },
    [onChange, balance]
  );

  const handleMaxClick = useCallback(() => {
    onChange(usd(balance));
  }, [onChange, balance]);

  const exceedsBalance = value > balance;
  const belowMinimum = value > 0 && value < MIN_TRADE_AMOUNT;
  const hasError = exceedsBalance || belowMinimum;

  return (
    <div>
      {/* Label row */}
      <div className="mb-2 flex items-center justify-between">
        <label
          htmlFor="collateral-input"
          className="text-sm font-medium text-text-secondary"
        >
          Collateral
        </label>
        <button
          onClick={handleMaxClick}
          disabled={disabled || balance <= 0}
          className="text-xs font-medium text-blue-primary transition-colors hover:text-blue-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Max: {formatUSD(balance)}
        </button>
      </div>

      {/* Input container */}
      <div
        className={`relative flex items-center rounded-xl border-2 bg-bg-input transition-colors ${
          hasError
            ? "border-red-primary"
            : value > 0
            ? "border-blue-primary/60"
            : "border-border-primary focus-within:border-blue-primary/60"
        } ${disabled ? "opacity-50" : ""}`}
      >
        <span className="pl-4 text-sm text-text-muted">$</span>
        <input
          id="collateral-input"
          type="number"
          inputMode="decimal"
          min={0}
          max={balance}
          step="0.01"
          value={value || ""}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="0.00"
          aria-label="Collateral amount in USDC"
          className="flex-1 bg-transparent py-3 px-2 text-sm font-medium text-text-primary placeholder-text-muted focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="pr-4 text-xs font-medium text-text-muted">USDC</span>
      </div>

      {/* Error messages */}
      {exceedsBalance && (
        <p className="mt-1.5 text-xs text-red-primary">
          Exceeds balance ({formatUSD(balance)} available)
        </p>
      )}
      {belowMinimum && !exceedsBalance && (
        <p className="mt-1.5 text-xs text-red-primary">
          Minimum collateral is {formatUSD(MIN_TRADE_AMOUNT)}
        </p>
      )}

      {/* Percent preset buttons */}
      <div className="mt-2 flex gap-2">
        {PERCENT_PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => handlePercentClick(preset.fraction)}
            disabled={disabled || balance <= 0}
            className="flex-1 rounded-lg border border-border-primary bg-bg-card py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-blue-primary/40 hover:text-blue-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const CollateralInput = memo(CollateralInputInner);
export default CollateralInput;
