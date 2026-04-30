"use client";

import { type ReactNode } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";

// ─── Props ───────────────────────────────────────────────

interface WalletAnimatorProps {
  /** Whether to show the popup */
  visible: boolean;
  /** Popup content */
  children: ReactNode;
}

// ─── Slide-up animation variants (MetaMask-style) ────────

const slideUpVariants: Variants = {
  initial: { y: "100%", opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      damping: 28,
      stiffness: 300,
      mass: 0.8,
    },
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: {
      duration: 0.2,
      ease: "easeIn",
    },
  },
};

// ─── Component ───────────────────────────────────────────

export function WalletAnimator({ visible, children }: WalletAnimatorProps) {
  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          key="wallet-popup"
          variants={slideUpVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none"
        >
          <div className="pointer-events-auto w-full max-w-md px-4 pb-8">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WalletAnimator;
