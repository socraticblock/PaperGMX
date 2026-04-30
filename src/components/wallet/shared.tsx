"use client";

// ─── Shared wallet popup utilities ───────────────────────

interface DetailRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  tooltip?: string;
}

export function DetailRow({ label, value, highlight, tooltip }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-text-muted">
        {label}
        {tooltip && (
          <span title={tooltip} className="ml-1 cursor-help opacity-60">
            ⓘ
          </span>
        )}
      </span>
      <span
        className={`text-xs font-mono ${
          highlight ? "text-text-primary font-semibold" : "text-text-secondary"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Shorten an Ethereum address for display.
 * e.g. "0x7452c554...5Bb8"
 */
export function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
