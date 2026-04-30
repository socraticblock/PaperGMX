"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import type {
  OrderDirection,
  USD,
  BPS,
  MarketSlug,
  PriceData,
  MarketInfo,
} from "@/types";
import type { PopupProcessingState } from "@/hooks/useWalletSimulation";
import {
  calculatePositionSize,
  calculatePositionFee,
  calculateAcceptablePrice,
  determineFillPrice,
} from "@/lib/calculations";
import { formatUSD, formatPrice } from "@/lib/format";
import { MARKETS, DEFAULT_POSITION_FEE_BPS, SLIPPAGE_OPEN_BPS, FAKE_WALLET_ADDRESS } from "@/lib/constants";
import { DetailRow } from "./shared";

// ─── Props ───────────────────────────────────────────────

interface SigningPopupProps {
  direction: OrderDirection;
  collateralUsd: USD;
  leverage: number;
  market: MarketSlug;
  priceData: PriceData | undefined;
  marketInfo: MarketInfo | undefined;
  processing: PopupProcessingState;
  onConfirm: () => void;
  onReject: () => void;
}

// ─── Component ───────────────────────────────────────────

function SigningPopupInner({
  direction,
  collateralUsd,
  leverage,
  market,
  priceData,
  marketInfo,
  processing,
  onConfirm,
  onReject,
}: SigningPopupProps) {
  const marketConfig = MARKETS[market];
  const isLong = direction === "long";

  // Calculate all values fresh for the signing confirmation
  const details = useMemo(() => {
    if (!priceData || priceData.last <= 0) return null;

    const sizeUsd = calculatePositionSize(collateralUsd, leverage);
    const feeBps: BPS = marketInfo?.positionFeeBps ?? DEFAULT_POSITION_FEE_BPS;
    const positionFee = calculatePositionFee(sizeUsd, feeBps);
    const fillPrice = determineFillPrice(priceData.min, priceData.max, direction, false);
    const acceptablePrice = calculateAcceptablePrice(fillPrice, SLIPPAGE_OPEN_BPS, direction, false);

    return { sizeUsd, positionFee, fillPrice, acceptablePrice, feeBps };
  }, [collateralUsd, leverage, direction, priceData, marketInfo]);

  const isIdle = processing === "idle";
  const isProcessing = processing === "processing";
  const isSuccess = processing === "success";

  return (
    <div className="rounded-2xl border border-border-primary bg-bg-card shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border-primary px-5 py-4">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full ${
            isLong ? "bg-green-primary/20" : "bg-red-primary/20"
          }`}
        >
          {isLong ? (
            <svg className="h-4 w-4 text-green-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
            </svg>
          ) : (
            <svg className="h-4 w-4 text-red-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 4.5l15 15m0 0V8.25m0 11.25H8.25" />
            </svg>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Confirm Transaction
          </h2>
          <p className="text-xs text-text-muted">{FAKE_WALLET_ADDRESS}</p>
        </div>
        <div className="ml-auto">
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${
              isLong
                ? "bg-green-primary/20 text-green-primary"
                : "bg-red-primary/20 text-red-primary"
            }`}
          >
            {isLong ? "LONG" : "SHORT"}
          </span>
        </div>
      </div>

      {/* Order Details */}
      <div className="px-5 py-4 space-y-3">
        <DetailRow label="Market" value={marketConfig.pair} />
        <DetailRow
          label="Position Size"
          value={details ? formatUSD(details.sizeUsd) : "—"}
          highlight
        />
        <DetailRow label="Leverage" value={`${leverage}x`} />
        <DetailRow
          label="Collateral"
          value={formatUSD(collateralUsd)}
        />
        <DetailRow
          label="Est. Entry"
          value={
            details
              ? `$${formatPrice(details.fillPrice, marketConfig.decimals)}`
              : "—"
          }
        />
        <DetailRow
          label="Acceptable Price"
          value={
            details
              ? `$${formatPrice(details.acceptablePrice, marketConfig.decimals)}`
              : "—"
          }
          tooltip="Max slippage 0.5%"
        />
        <DetailRow
          label="Position Fee"
          value={details ? formatUSD(details.positionFee) : "—"}
          tooltip={`${details?.feeBps ?? 6} BPS`}
        />
        <DetailRow label="Est. Gas" value="~$0.65" />
      </div>

      {/* Disclaimer */}
      <div className="mx-5 mb-4 rounded-lg bg-bg-input px-3 py-2">
        <p className="text-[10px] text-text-muted leading-relaxed text-center">
          Paper trading simulation. Same fees & pricing as GMX V2, zero real risk.
        </p>
      </div>

      {/* Buttons */}
      <div className="flex gap-3 px-5 pb-5">
        {isIdle && (
          <>
            <button
              onClick={onReject}
              className="flex-1 rounded-xl border border-border-primary py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-bg-input"
            >
              Reject
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 rounded-xl py-3 text-sm font-bold text-white transition-all hover:brightness-110 active:scale-[0.98] ${
                isLong ? "bg-green-primary" : "bg-red-primary"
              }`}
            >
              Confirm
            </button>
          </>
        )}

        {isProcessing && (
          <div
            className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 ${
              isLong ? "bg-green-primary/20" : "bg-red-primary/20"
            }`}
          >
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current text-blue-primary" />
            <span className="text-sm font-medium text-blue-primary">
              Submitting...
            </span>
          </div>
        )}

        {isSuccess && (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-primary/20 py-3">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="text-lg text-green-primary"
              aria-hidden="true"
            >
              ✓
            </motion.span>
            <span className="text-sm font-bold text-green-primary">
              Confirmed!
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export const SigningPopup = memo(SigningPopupInner);
export default SigningPopup;
