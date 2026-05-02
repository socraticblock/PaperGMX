"use client";

import { memo, useCallback, useState } from "react";
import { ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";
import type { ClosedTrade } from "@/types";
import {
  copyTradeSummaryToClipboard,
  formatClosedTradeShareText,
} from "@/lib/shareTradeSummary";

export interface ShareTradeSummaryButtonProps {
  trade: ClosedTrade;
  /** Smaller control for dense tables */
  compact?: boolean;
  className?: string;
}

function ShareTradeSummaryButtonInner({
  trade,
  compact = false,
  className = "",
}: ShareTradeSummaryButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleClick = useCallback(async () => {
    const ok = await copyTradeSummaryToClipboard(formatClosedTradeShareText(trade));
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }, [trade]);

  return (
    <button
      type="button"
      onClick={handleClick}
      title={copied ? "Copied" : "Copy trade summary"}
      aria-label={copied ? "Copied to clipboard" : "Copy trade summary to clipboard"}
      className={`inline-flex shrink-0 items-center justify-center rounded-md border transition-colors ${
        compact
          ? "h-8 w-8 border-trade-border-subtle bg-trade-panel text-text-muted hover:border-trade-border-active hover:text-text-secondary"
          : "gap-1.5 border-border-primary bg-bg-input px-2.5 py-1.5 text-xs font-medium text-text-secondary hover:border-blue-primary hover:text-text-primary"
      } ${className}`}
    >
      {copied ? (
        <>
          <CheckIcon className="h-4 w-4 text-green-primary" aria-hidden="true" />
          {!compact && <span className="text-green-primary">Copied</span>}
        </>
      ) : (
        <>
          <ClipboardDocumentIcon className={compact ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
          {!compact && <span>Share</span>}
        </>
      )}
    </button>
  );
}

export const ShareTradeSummaryButton = memo(ShareTradeSummaryButtonInner);
export default ShareTradeSummaryButton;
