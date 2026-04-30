"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import MarketGrid from "@/components/trade/MarketGrid";
import { usePriceService } from "@/hooks/usePriceService";
import type { MarketSlug } from "@/types";

export default function MarketsPage() {
  const router = useRouter();
  const isInitialized = usePaperStore(useShallow((s) => s.isInitialized));

  // Start price service
  usePriceService();

  // Redirect to landing if not initialized
  useEffect(() => {
    if (!isInitialized) {
      router.push("/");
    }
  }, [isInitialized, router]);

  const handleSelectMarket = (slug: MarketSlug) => {
    router.push(`/trade/${slug}`);
  };

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-text-muted">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SettingsPanel />

      <main className="flex-1 px-4 py-6 md:px-6">
        <div className="mx-auto max-w-2xl">
          <MarketGrid onSelectMarket={handleSelectMarket} />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-primary px-4 py-4 text-center">
        <a
          href="https://app.gmx.io"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-text-muted transition-colors hover:text-blue-primary"
        >
          Ready for real trading? Switch to GMX →
        </a>
      </footer>
    </div>
  );
}
