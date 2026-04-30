"use client";

import { memo } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { MARKET_SLUGS } from "@/lib/constants";
import type { MarketSlug, ApiConnectionStatus } from "@/types";
import MarketCard from "./MarketCard";

export interface MarketGridProps {
  onSelectMarket: (slug: MarketSlug) => void;
}

const STATUS_CONFIG: Record<ApiConnectionStatus, { label: string; color: string }> = {
  connected: { label: "Live", color: "bg-green-primary" },
  degraded: { label: "Slow", color: "bg-yellow-primary" },
  fallback: { label: "Binance", color: "bg-yellow-primary" },
  disconnected: { label: "Offline", color: "bg-red-primary" },
};

function MarketGridInner({ onSelectMarket }: MarketGridProps) {
  const connectionStatus = usePaperStore(useShallow((s) => s.connectionStatus));
  const pricesLoaded = usePaperStore(useShallow((s) => s.pricesLoaded));

  const statusConfig = STATUS_CONFIG[connectionStatus];

  return (
    <div>
      {/* Header with connection status */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-text-primary">Select a Market</h2>
          <p className="text-sm text-text-muted">4 Perpetual Futures</p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusConfig.color}`} aria-hidden="true" />
          <span className="text-xs text-text-secondary">{statusConfig.label}</span>
        </div>
      </div>

      {/* Stale/Fallback warning */}
      {connectionStatus === "fallback" && (
        <div className="mb-4 rounded-lg border border-yellow-primary/30 bg-yellow-bg p-3">
          <p className="text-xs text-yellow-primary">
            GMX API unavailable. Using Binance data — prices may differ slightly from GMX oracle.
          </p>
        </div>
      )}
      {connectionStatus === "disconnected" && (
        <div className="mb-4 rounded-lg border border-red-primary/30 bg-red-bg p-3">
          <p className="text-xs text-red-primary">
            Price data unavailable. Check your internet connection.
          </p>
        </div>
      )}

      {/* Market cards grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {MARKET_SLUGS.map((slug) => (
          <MarketCard
            key={slug}
            slug={slug as MarketSlug}
            onClick={onSelectMarket}
          />
        ))}
      </div>

      {/* Loading state */}
      {!pricesLoaded && connectionStatus === "connected" && (
        <div className="mt-4 text-center">
          <p className="text-sm text-text-muted animate-pulse">Loading prices...</p>
        </div>
      )}
    </div>
  );
}

export const MarketGrid = memo(MarketGridInner);
export default MarketGrid;
