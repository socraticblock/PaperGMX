"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  children: ReactNode;
  /** Square hit target size in px-ish (Tailwind h/w). */
  size?: "sm" | "md";
}

export function IconButton({
  children,
  size = "md",
  className = "",
  ...rest
}: IconButtonProps) {
  const sz = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  return (
    <button
      type="button"
      className={`inline-flex ${sz} shrink-0 items-center justify-center rounded-md border border-trade-border-subtle bg-trade-raised text-text-secondary transition-colors hover:border-trade-border-active hover:bg-trade-panel hover:text-text-primary disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
