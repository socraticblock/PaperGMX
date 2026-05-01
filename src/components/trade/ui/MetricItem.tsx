"use client";

import type { ReactNode } from "react";

export interface MetricItemProps {
  label: string;
  value: ReactNode;
  className?: string;
}

/** Compact label/value pair for top market strip (GMX-style). */
export function MetricItem({ label, value, className = "" }: MetricItemProps) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
        {label}
      </span>
      <span className="text-[length:var(--text-trade-stat)] font-medium tabular-nums text-text-secondary">
        {value}
      </span>
    </div>
  );
}
