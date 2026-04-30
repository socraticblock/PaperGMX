"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Props ───────────────────────────────────────────────

interface WalletOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  // Note: intentionally no onDismiss — MetaMask doesn't allow
  // dismissing by clicking the backdrop. User must use Reject.
}

// ─── Component ───────────────────────────────────────────

function WalletOverlayInner({ visible }: WalletOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="wallet-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}

export const WalletOverlay = memo(WalletOverlayInner);
export default WalletOverlay;
