"use client";

import { memo } from "react";
import type { OrderDirection } from "@/types";
import { motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────

export interface DirectionToggleProps {
  direction: OrderDirection;
  onChange: (direction: OrderDirection) => void;
  disabled?: boolean;
}

// ─── Component ────────────────────────────────────────────

function DirectionToggleInner({
  direction,
  onChange,
  disabled = false,
}: DirectionToggleProps) {
  return (
    <div
      className="flex gap-2"
      role="radiogroup"
      aria-label="Trade direction"
    >
      {/* Long Button */}
      <button
        role="radio"
        aria-checked={direction === "long"}
        aria-label="Long position"
        onClick={() => onChange("long")}
        disabled={disabled}
        className={`relative flex-1 rounded-xl py-3 text-center text-sm font-bold transition-all duration-200 ${
          direction === "long"
            ? "bg-green-primary/15 text-green-primary border-2 border-green-primary"
            : "border-2 border-border-primary bg-bg-card text-text-secondary hover:border-green-primary/40 hover:text-green-primary/80"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {direction === "long" && (
          <motion.div
            layoutId="direction-indicator"
            className="absolute inset-0 rounded-xl bg-green-primary/10"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <span className="relative z-10">Long</span>
      </button>

      {/* Short Button */}
      <button
        role="radio"
        aria-checked={direction === "short"}
        aria-label="Short position"
        onClick={() => onChange("short")}
        disabled={disabled}
        className={`relative flex-1 rounded-xl py-3 text-center text-sm font-bold transition-all duration-200 ${
          direction === "short"
            ? "bg-red-primary/15 text-red-primary border-2 border-red-primary"
            : "border-2 border-border-primary bg-bg-card text-text-secondary hover:border-red-primary/40 hover:text-red-primary/80"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        {direction === "short" && (
          <motion.div
            layoutId="direction-indicator"
            className="absolute inset-0 rounded-xl bg-red-primary/10"
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
          />
        )}
        <span className="relative z-10">Short</span>
      </button>
    </div>
  );
}

export const DirectionToggle = memo(DirectionToggleInner);
export default DirectionToggle;
