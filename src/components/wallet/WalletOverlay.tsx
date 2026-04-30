"use client";

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Props ───────────────────────────────────────────────

interface WalletOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when user clicks the dark backdrop (dismiss) */
  onDismiss?: () => void;
}

// ─── Component ───────────────────────────────────────────

function WalletOverlayInner({ visible, onDismiss }: WalletOverlayProps) {
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
          onClick={onDismiss}
          aria-hidden="true"
        />
      )}
    </AnimatePresence>
  );
}

export const WalletOverlay = memo(WalletOverlayInner);
export default WalletOverlay;
