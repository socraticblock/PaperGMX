"use client";

import { memo, useCallback, useState, useEffect } from "react";
import { MARKETS, LEVERAGE_PRESETS } from "@/lib/constants";
import type { MarketSlug } from "@/types";

// ─── Types ────────────────────────────────────────────────

export interface LeverageSliderProps {
  leverage: number;
  market: MarketSlug;
  onChange: (leverage: number) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────

function LeverageSliderInner({
  leverage,
  market,
  onChange,
  disabled = false,
}: LeverageSliderProps) {
  const [inputValue, setInputValue] = useState(String(leverage));
  const maxLeverage = MARKETS[market].maxLeverage;

  // Sync input when leverage changes externally
  useEffect(() => {
    setInputValue(String(leverage));
  }, [leverage]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      if (Number.isFinite(val) && val >= 1 && val <= maxLeverage) {
        onChange(val);
      }
    },
    [onChange, maxLeverage]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInputValue(raw);

      const val = parseInt(raw, 10);
      if (Number.isFinite(val) && val >= 1 && val <= maxLeverage) {
        onChange(val);
      }
    },
    [onChange, maxLeverage]
  );

  const handlePresetClick = useCallback(
    (preset: number) => {
      onChange(Math.min(preset, maxLeverage));
    },
    [onChange, maxLeverage]
  );

  // Calculate slider percentage for gradient
  const sliderPercent = ((leverage - 1) / (maxLeverage - 1)) * 100;

  // Leverage danger level for color coding
  const isHighRisk = leverage >= 25;
  const dangerLevel =
    leverage <= 5 ? "low" : leverage <= 15 ? "medium" : "high";

  const trackColor =
    dangerLevel === "low"
      ? "bg-green-primary"
      : dangerLevel === "medium"
      ? "bg-yellow-primary"
      : "bg-red-primary";

  return (
    <div>
      {/* Label row */}
      <div className="mb-2 flex items-center justify-between">
        <label
          htmlFor="leverage-slider"
          className="text-sm font-medium text-text-secondary"
        >
          Leverage
        </label>
        <div className="flex items-center gap-1.5">
          <input
            id="leverage-input"
            type="number"
            min={1}
            max={maxLeverage}
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled}
            className={`w-14 rounded-lg border border-border-primary bg-bg-input px-2 py-1 text-right text-sm font-bold text-text-primary focus:border-blue-primary focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
              disabled ? "opacity-50" : ""
            }`}
            aria-label="Leverage multiplier"
          />
          <span className="text-xs font-medium text-text-muted">x</span>
        </div>
      </div>

      {/* Risk badge for high leverage (spec 3.3) */}
      {isHighRisk && (
        <div className="mb-2 flex items-center gap-1.5 rounded-lg bg-red-bg px-2 py-1">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-primary flex-shrink-0">
            <path d="M6 1L11 10H1L6 1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M6 4.5V6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="6" cy="8.5" r="0.5" fill="currentColor"/>
          </svg>
          <span className="text-[10px] font-semibold text-red-primary">
            High risk — liquidation within {dangerLevel === "high" ? (leverage >= 40 ? "2-3%" : "4-8%") : "8-15%"} price move
          </span>
        </div>
      )}

      {/* Slider */}
      <div className="relative">
        <input
          id="leverage-slider"
          type="range"
          min={1}
          max={maxLeverage}
          step={1}
          value={leverage}
          onChange={handleSliderChange}
          disabled={disabled}
          className="leverage-slider w-full"
          aria-label="Leverage slider"
          style={
            {
              "--slider-percent": `${sliderPercent}%`,
              "--slider-color": `var(${
                dangerLevel === "low"
                  ? "--color-green-primary"
                  : dangerLevel === "medium"
                  ? "--color-yellow-primary"
                  : "--color-red-primary"
              })`,
            } as React.CSSProperties
          }
        />
      </div>

      {/* Preset buttons — uses LEVERAGE_PRESETS from constants.ts */}
      <div className="mt-2 flex gap-2">
        {LEVERAGE_PRESETS.map((preset) => {
          const isActive = leverage === preset;
          const isOverMax = preset > maxLeverage;
          return (
            <button
              key={preset}
              onClick={() => handlePresetClick(preset)}
              disabled={disabled || isOverMax}
              className={`flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all ${
                isActive
                  ? `${trackColor} text-white border-transparent`
                  : isOverMax
                  ? "border-border-primary/30 bg-bg-card text-text-muted/40 cursor-not-allowed"
                  : "border-border-primary bg-bg-card text-text-secondary hover:border-border-hover"
              } ${disabled && !isOverMax ? "opacity-50" : ""}`}
            >
              {preset}x
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const LeverageSlider = memo(LeverageSliderInner);
export default LeverageSlider;
