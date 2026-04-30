"use client";

import { usePaperStore } from "@/store/usePaperStore";
import Header from "@/components/Header";
import SettingsPanel from "@/components/SettingsPanel";
import BalanceSelector from "@/components/BalanceSelector";
import Logo from "@/components/Logo";
import { motion } from "framer-motion";
import {
  ShieldCheckIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";

const features = [
  {
    icon: ShieldCheckIcon,
    title: "No Wallet Needed",
    description:
      "Trade instantly. No MetaMask, no crypto, no signup. Just pick a balance and start.",
  },
  {
    icon: ChartBarIcon,
    title: "Real GMX Prices",
    description:
      "Live oracle prices from GMX V2 on Arbitrum. Same market data real traders see.",
  },
  {
    icon: CurrencyDollarIcon,
    title: "Exact Fee Simulation",
    description:
      "Position fees, borrow fees, funding rates, liquidation fees — all calculated like real GMX.",
  },
];

export default function Home() {
  const isInitialized = usePaperStore((s) => s.isInitialized);

  // If already initialized, show the landing with option to continue
  // (In Phase 2, this will auto-redirect to market selection)
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SettingsPanel />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl text-center"
        >
          {/* Hero */}
          <div className="mb-2">
            <Logo size="large" />
          </div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="mt-6 text-3xl font-bold text-text-primary md:text-4xl"
          >
            Try GMX Perps for Free
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-3 text-lg text-text-secondary"
          >
            Real prices. Real fees. Fake money.
          </motion.p>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mt-1 text-sm text-text-muted"
          >
            Powered by GMX V2 on Arbitrum
          </motion.p>

          {/* Balance Selection */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mt-10"
          >
            <p className="mb-4 text-sm font-medium text-text-secondary">
              {isInitialized
                ? "Choose a new starting balance or continue with your current one"
                : "Choose your starting balance to begin"}
            </p>
            <BalanceSelector />
          </motion.div>

          {/* Feature Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="mt-14 grid grid-cols-1 gap-4 md:grid-cols-3"
          >
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                className="rounded-xl border border-border-primary bg-bg-card p-5 text-left"
              >
                <feature.icon className="h-6 w-6 text-blue-primary" />
                <h3 className="mt-3 text-sm font-semibold text-text-primary">
                  {feature.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="mt-12 pb-8"
          >
            <a
              href="https://app.gmx.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-text-muted transition-colors hover:text-blue-primary"
            >
              Ready for real trading? Switch to GMX →
            </a>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
