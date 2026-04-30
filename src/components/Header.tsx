"use client";

import { usePaperStore } from "@/store/usePaperStore";
import { formatBalance } from "@/lib/format";
import { Cog6ToothIcon } from "@heroicons/react/24/outline";

export default function Header() {
  const balance = usePaperStore((s) => s.balance);
  const isInitialized = usePaperStore((s) => s.isInitialized);
  const setSettingsOpen = usePaperStore((s) => s.setSettingsOpen);
  const activePosition = usePaperStore((s) => s.activePosition);

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border-primary bg-bg-primary/80 px-4 py-3 backdrop-blur-md md:px-6">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-primary text-sm font-bold text-white">
          P
        </div>
        <span className="text-lg font-bold text-text-primary">
          Paper<span className="text-blue-primary">GMX</span>
        </span>
        {activePosition && (
          <span className="ml-2 rounded-full bg-green-bg px-2 py-0.5 text-xs font-medium text-green-primary">
            Position Active
          </span>
        )}
      </div>

      {/* Balance */}
      {isInitialized && (
        <div className="flex items-center gap-1.5 rounded-lg border border-border-primary bg-bg-card px-3 py-1.5">
          <div className="h-2 w-2 rounded-full bg-green-primary" />
          <span className="text-sm font-medium text-text-primary">
            {formatBalance(balance)}
          </span>
        </div>
      )}

      {/* Settings */}
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-primary bg-bg-card text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
        aria-label="Settings"
      >
        <Cog6ToothIcon className="h-5 w-5" />
      </button>
    </header>
  );
}
