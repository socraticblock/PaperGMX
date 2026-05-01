"use client";

import type { ReactNode } from "react";

export interface PanelProps {
  children: ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md";
}

const paddingClass = {
  none: "",
  sm: "p-3",
  md: "p-4",
} as const;

/**
 * GMX-style bordered surface for chart and order column blocks.
 */
export function Panel({ children, className = "", padding = "none" }: PanelProps) {
  return (
    <div
      className={`rounded-lg border border-trade-border bg-trade-panel ${paddingClass[padding]} ${className}`}
    >
      {children}
    </div>
  );
}
