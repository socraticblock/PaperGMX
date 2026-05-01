"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[PaperGMX] Runtime error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-4">
      <div className="rounded-xl border border-red-primary/30 bg-red-bg p-8 text-center max-w-md">
        <h2 className="text-lg font-bold text-red-primary">
          Something went wrong
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          PaperGMX encountered an unexpected error. Your data is safe in local
          storage.
        </p>
        <button
          onClick={reset}
          className="mt-4 rounded-lg bg-blue-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-hover"
        >
          Try Again
        </button>
        <button
          onClick={() => {
            localStorage.removeItem("papergmx-storage");
            window.location.reload();
          }}
          className="mt-2 block w-full text-xs text-text-muted hover:text-red-primary transition-colors"
        >
          Reset all data and reload
        </button>
      </div>
    </div>
  );
}
