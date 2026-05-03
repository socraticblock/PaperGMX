"use client";

import { memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
    label: "Oracle live",
  },
  degraded: {
    dotColor: "bg-yellow-primary",
    pulse: true,
    label: "Oracle stale",
  },
  disconnected: {
    dotColor: "bg-red-primary",
    pulse: false,
    label: "Disconnected",
  },
};

// ─── Connection Strip (compact, right-aligned in header) ─────

function ConnectionPulse() {
  const connectionStatus = usePaperStore(useShallow((s) => s.connectionStatus));
  const config = STATUS_CONFIG[connectionStatus];

  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-trade-border-subtle bg-trade-raised px-2 py-1"
      title={config.label}
      aria-label={`Connection: ${config.label}`}
      role="status"
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${config.dotColor} opacity-40`}
            aria-hidden="true"
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.dotColor}`}
          aria-hidden="true"
        />
      </span>
      <span className="hidden text-[length:var(--text-trade-stat)] text-text-secondary sm:inline">
        {config.label}
      </span>
    </div>
  );
}

// ─── Header ─────────────────────────────────────────────────

function HeaderInner() {
  const pathname = usePathname();
  const { balance, isInitialized, positionsCount, setSettingsOpen } =
    usePaperStore(
      useShallow((s) => ({
        balance: s.balance,
        isInitialized: s.isInitialized,
        positionsCount: s.positions.length,
        setSettingsOpen: s.setSettingsOpen,
      })),
    );

  const hasPosition = positionsCount > 0;

  const navBtn =
    "rounded-md px-2.5 py-1 text-[length:var(--text-trade-body)] font-medium transition-colors";
  const navIdle = `${navBtn} text-text-muted hover:bg-trade-raised hover:text-text-secondary`;
  const navActive = `${navBtn} bg-trade-raised text-text-primary`;

  return (
    <header className="sticky top-0 z-40 border-b border-trade-border-subtle bg-trade-strip/95 px-3 py-2 backdrop-blur-md md:px-5">
      <div className="mx-auto flex max-w-[1920px] items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 md:gap-3">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-primary text-xs font-bold text-white md:h-8 md:w-8 md:text-sm"
              aria-hidden="true"
            >
              P
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-bold text-text-primary md:text-lg">
                  Paper<span className="text-blue-primary">GMX</span>
                </span>
                {hasPosition && (
                  <span className="rounded border border-trade-border-active bg-trade-raised px-1.5 py-px text-[length:var(--text-trade-label)] font-semibold uppercase tracking-wide text-green-primary">
                    Open positions ({positionsCount})
                  </span>
                )}
              </div>
            </div>
          </Link>

          <nav
            className="hidden items-center gap-0.5 md:flex"
            aria-label="Primary"
          >
            <Link
              href="/"
              className={pathname === "/" ? navActive : navIdle}
            >
              Home
            </Link>
            <Link
              href="/markets"
              className={pathname === "/markets" ? navActive : navIdle}
            >
              Markets
            </Link>
            <Link
              href="/trade/eth"
              className={
                pathname?.startsWith("/trade") ? navActive : navIdle
              }
            >
              Trade
            </Link>
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <ConnectionPulse />

          {isInitialized && (
            <div
              className="flex max-w-[118px] items-center gap-1.5 truncate rounded-md border border-trade-border-subtle bg-trade-panel px-2 py-1 sm:max-w-none md:px-3"
              aria-live="polite"
              aria-label={`Balance ${formatBalance(balance)}`}
            >
              <span
                className="h-1.5 w-1.5 rounded-full bg-green-primary"
                aria-hidden="true"
              />
              <span className="text-sm font-medium tabular-nums text-text-primary">
                {formatBalance(balance)}
              </span>
            </div>
          )}

          <button
            onClick={() => setSettingsOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-trade-border-subtle bg-trade-panel text-text-secondary transition-colors hover:border-trade-border-active hover:text-text-primary"
            aria-label="Open settings"
          >
            <Cog6ToothIcon className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderInner);
export default Header;
