"use client";

import type { ReactNode } from "react";

export interface PanelHeaderProps {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function PanelHeader({
  children,
  trailing,
  className = "",
}: PanelHeaderProps) {
  return (
    <div
      className={`flex min-h-9 items-center justify-between border-b border-trade-border-subtle px-3 py-2 md:px-4 ${className}`}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {trailing ? <div className="ml-2 shrink-0">{trailing}</div> : null}
    </div>
  );
}
