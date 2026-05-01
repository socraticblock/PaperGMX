"use client";

import { memo } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { formatBalance } from "@/lib/format";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";
import type { ApiConnectionStatus } from "@/types";

// ─── Connection Status Config ───────────────────────────────

const STATUS_CONFIG: Record<
  ApiConnectionStatus,
  { dotColor: string; pulse: boolean; label: string }
> = {
  connected: {
    dotColor: "bg-green-primary",
    pulse: true,
    label: "GMX Oracle Live",
  },
  degraded: {
    dotColor: "bg-yellow-primary",
    pulse: true,
    label: "GMX API Slow",
  },
  fallback: {
    dotColor: "bg-yellow-primary",
    pulse: true,
    label: "Binance Fallback",
  },
  disconnected: {
    dotColor: "bg-red-primary",
    pulse: false,
    label: "Disconnected",
  },
};

// ─── Connection Pulse Component ─────────────────────────────

function ConnectionPulse() {
  const connectionStatus = usePaperStore(useShallow((s) => s.connectionStatus));
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <div
      className="flex items-center gap-1.5"
      title={config.label}
      aria-label={`Connection status: ${config.label}`}
      role="status"
    >
      <span className="relative flex h-2.5 w-2.5">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dotColor} opacity-40`}
            aria-hidden="true"
          />
        )}
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${config.dotColor}`}
          aria-hidden="true"
        />
      </span>
      <span className="text-xs text-text-secondary hidden sm:inline">
        {config.label}
      </span>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────

function HeaderInner() {
  const { balance, isInitialized, activePosition, setSettingsOpen } =
    usePaperStore(
      useShallow((s) => ({
        balance: s.balance,
        isInitialized: s.isInitialized,
        activePosition: s.activePosition,
        setSettingsOpen: s.setSettingsOpen,
      })),
    );

  const hasPosition = activePosition !== null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-primary bg-bg-primary/80 px-4 py-3 backdrop-blur-md md:px-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-primary text-sm font-bold text-white"
          aria-hidden="true"
        >
          P
        </div>
        <span className="text-lg font-bold text-text-primary">
          Paper<span className="text-blue-primary">GMX</span>
        </span>
        {hasPosition && (
          <span className="ml-2 rounded-full bg-green-bg px-2 py-0.5 text-xs font-medium text-green-primary">
            Position Active
          </span>
        )}
      </div>

      {/* Center: Connection Status Pulse */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <ConnectionPulse />
      </div>

      {/* Right: Balance + Settings */}
      <div className="flex items-center gap-3">
        {isInitialized && (
          <div
            className="flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card px-3 py-1.5"
            aria-live="polite"
            aria-label={`Current balance: ${formatBalance(balance)}`}
          >
            <div
              className="h-2 w-2 rounded-full bg-green-primary"
              aria-hidden="true"
            />
            <span className="text-sm font-medium text-text-primary">
              {formatBalance(balance)}
            </span>
          </div>
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
          aria-label="Open settings"
        >
          <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

export const Header = memo(HeaderInner);
export default Header;
