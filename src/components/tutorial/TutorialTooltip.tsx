"use client";

import { memo, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import { LightBulbIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface TutorialTooltipProps {
  /** Unique key used to track dismissal state in the store */
  tutorialKey: string;
  /** Tooltip title */
  title: string;
  /** Tooltip description */
  description: string;
  /** Position relative to the target element */
  position?: "bottom" | "top" | "left" | "right";
  /** Content to wrap with the tooltip */
  children: ReactNode;
}

// ─── Component ────────────────────────────────────────────

function TutorialTooltipInner({
  tutorialKey,
  title,
  description,
  position = "bottom",
  children,
}: TutorialTooltipProps) {
  const { tutorialEnabled, tutorialDismissed, dismissTutorial } = usePaperStore(
    useShallow((s) => ({
      tutorialEnabled: s.tutorialEnabled,
      tutorialDismissed: s.tutorialDismissed,
      dismissTutorial: s.dismissTutorial,
    }))
  );

  const isDismissed = tutorialDismissed[tutorialKey] === true;
  const shouldShow = tutorialEnabled && !isDismissed;

  // Position-based classes for the tooltip and arrow
  const positionClasses: Record<string, string> = {
    bottom: "top-full left-1/2 -translate-x-1/2 mt-3",
    top: "bottom-full left-1/2 -translate-x-1/2 mb-3",
    left: "right-full top-1/2 -translate-y-1/2 mr-3",
    right: "left-full top-1/2 -translate-y-1/2 ml-3",
  };

  const arrowClasses: Record<string, string> = {
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-blue-primary",
    top: "top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-blue-primary",
    left: "left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-blue-primary",
    right:
      "right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-blue-primary",
  };

  // Animation variants based on position
  const animationVariants: Record<string, { initial: { opacity: number; x?: number; y?: number }; animate: { opacity: number; x?: number; y?: number } }> = {
    bottom: {
      initial: { opacity: 0, y: -8 },
      animate: { opacity: 1, y: 0 },
    },
    top: {
      initial: { opacity: 0, y: 8 },
      animate: { opacity: 1, y: 0 },
    },
    left: {
      initial: { opacity: 0, x: 8 },
      animate: { opacity: 1, x: 0 },
    },
    right: {
      initial: { opacity: 0, x: -8 },
      animate: { opacity: 1, x: 0 },
    },
  };

  const anim = animationVariants[position] ?? animationVariants.bottom;

  return (
    <div className="relative">
      {children}

      <AnimatePresence>
        {shouldShow && anim && (
          <motion.div
            initial={anim.initial}
            animate={anim.animate}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`absolute z-50 w-72 ${positionClasses[position]}`}
            role="tooltip"
          >
            {/* Arrow */}
            <div
              className={`absolute ${arrowClasses[position]}`}
              aria-hidden="true"
            />

            {/* Tooltip body */}
            <div className="rounded-xl border border-blue-primary/50 bg-bg-card p-4 shadow-lg shadow-blue-primary/10">
              {/* Header */}
              <div className="mb-2 flex items-center gap-2">
                <LightBulbIcon
                  className="h-4 w-4 flex-shrink-0 text-blue-primary"
                  aria-hidden="true"
                />
                <h4 className="text-sm font-semibold text-blue-primary">
                  {title}
                </h4>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed text-text-secondary">
                {description}
              </p>

              {/* Dismiss button */}
              <button
                onClick={() => dismissTutorial(tutorialKey)}
                className="mt-3 w-full rounded-lg bg-blue-primary/10 px-3 py-1.5 text-xs font-medium text-blue-primary transition-colors hover:bg-blue-primary/20"
              >
                Got it
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export const TutorialTooltip = memo(TutorialTooltipInner);
export default TutorialTooltip;
