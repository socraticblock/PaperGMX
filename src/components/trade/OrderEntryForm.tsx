"use client";

import { memo, useCallback, useState } from "react";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type { OrderDirection, MarketSlug, Position, USD } from "@/types";
import type { SegmentOption } from "./ui/SegmentedControl";
import { usd } from "@/lib/branded";
import { SegmentedControl } from "./ui";
import CollateralInput from "./CollateralInput";
import OrderSummary from "./OrderSummary";
import { MARKETS } from "@/lib/constants";
import { calculatePositionSize } from "@/lib/calculations";
import { formatUSD, formatPrice } from "@/lib/format";
import SubmitOrderButton from "./SubmitOrderButton";
import { useWalletSimulation } from "@/hooks/useWalletSimulation";
import { useLiquidationChecker } from "@/hooks/useLiquidationChecker";
import { useFeeAccrual } from "@/hooks/useFeeAccrual";
import { WalletOverlay } from "@/components/wallet/WalletOverlay";
import { WalletAnimator } from "@/components/wallet/WalletAnimator";
import { ApprovalPopup } from "@/components/wallet/ApprovalPopup";
import { SigningPopup } from "@/components/wallet/SigningPopup";
import { KeeperWaitScreen } from "@/components/keeper/KeeperWaitScreen";
import { OrderResultScreen } from "@/components/keeper/OrderResultScreen";
import { PositionCard } from "@/components/position/PositionCard";
import { ClosePositionForm } from "@/components/position/ClosePositionForm";
import { LiquidationScreen } from "@/components/position/LiquidationScreen";
import { ClosedTradeResultCard } from "@/components/position/ClosedTradeResultCard";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";

// ─── Types ────────────────────────────────────────────────

export interface OrderEntryFormProps {
  market: MarketSlug;
}

// ─── Helper: is order in keeper phase? ────────────────────

const TRADE_MODE_OPTIONS = [
  { value: "long", label: "Long", tone: "long" as const },
  { value: "short", label: "Short", tone: "short" as const },
  { value: "swap", label: "Swap", disabled: true },
] as const satisfies readonly SegmentOption<OrderDirection | "swap">[];

function isKeeperPhase(status: string): boolean {
  return (
    status === "submitted" ||
    status === "keeper_step_1" ||
    status === "keeper_step_2" ||
    status === "keeper_step_3" ||
    status === "keeper_step_4"
  );
}

// ─── Component ────────────────────────────────────────────

function OrderEntryFormInner({ market }: OrderEntryFormProps) {
  // ─── Store subscriptions ────────────────────────────────
  const {
    balance,
    activePosition,
    orderStatus,
    prices,
    marketInfo,
    connectionStatus,
    simulateKeeperDelay,
    approvedTokens,
    lockCollateral,
    setActivePosition,
    setOrderStatus,
    dismissOrderResult,
  } = usePaperStore(
    useShallow((s) => ({
      balance: s.balance,
      activePosition: s.activePosition,
      orderStatus: s.orderStatus,
      prices: s.prices,
      marketInfo: s.marketInfo,
      connectionStatus: s.connectionStatus,
      simulateKeeperDelay: s.simulateKeeperDelay,
      approvedTokens: s.approvedTokens,
      lockCollateral: s.lockCollateral,
      setActivePosition: s.setActivePosition,
      setOrderStatus: s.setOrderStatus,
      dismissOrderResult: s.dismissOrderResult,
    })),
  );

  // ─── Wallet simulation hook ─────────────────────────────
  const wallet = useWalletSimulation();

  // ─── Derived data ───────────────────────────────────────
  const priceData = prices[market];
  const info = marketInfo[market];
  const hasActivePosition = activePosition !== null;
  const needsApproval = !approvedTokens.includes("USDC");

  // ─── Liquidation checker (runs while position is active) ──
  // This hook runs side effects (auto-liquidation) — return value is for
  // consumers that need real-time liquidation status, but we don't use it
  // directly here since the LiquidationScreen is triggered via trade history.
  useLiquidationChecker(activePosition, prices);

  // ─── Fee accrual (runs while position is active) ─────────
  // Accrues borrow and funding fees every price update cycle.
  useFeeAccrual(activePosition, prices);

  // ─── Trade history for liquidation detection ─────────────
  const tradeHistory = usePaperStore(useShallow((s) => s.tradeHistory));

  // ─── Liquidation screen state ────────────────────────────
  // Track dismissed liquidation trade IDs so the screen doesn't re-show
  const [dismissedLiquidationIds, setDismissedLiquidationIds] = useState<
    Set<string>
  >(() => new Set());

  // Derive whether to show the LiquidationScreen from trade history
  const lastTrade = tradeHistory.length > 0 ? tradeHistory[0] : null;
  const recentLiquidation =
    !hasActivePosition &&
    lastTrade &&
    lastTrade.closeReason === "liquidated" &&
    !dismissedLiquidationIds.has(lastTrade.id)
      ? lastTrade
      : null;

  const handleLiquidationDismiss = useCallback(() => {
    if (lastTrade) {
      setDismissedLiquidationIds((prev) => {
        const next = new Set([...prev, lastTrade.id]);
        // Prune: only keep IDs that still exist in trade history to prevent
        // unbounded growth over many sessions.
        if (next.size > 20) {
          const historyIds = new Set(tradeHistory.slice(0, 20).map((t) => t.id));
          for (const id of next) {
            if (!historyIds.has(id)) next.delete(id);
          }
        }
        return next;
      });
    }
    // Also dismiss the order result (liquidation sets orderStatus to "filled"
    // via direct setState). Without this, the OrderResultScreen would appear
    // after the LiquidationScreen is dismissed.
    dismissOrderResult();
  }, [lastTrade, tradeHistory, dismissOrderResult]);

  /** Manual close completes with activePosition cleared — close form unmounts before its result UI. */
  const manualCloseNeedsDismiss =
    !hasActivePosition &&
    orderStatus === "filled" &&
    lastTrade != null &&
    lastTrade.closeReason !== "liquidated";

  // ─── Local form state ───────────────────────────────────
  const [direction, setDirection] = useState<OrderDirection>("long");
  const [collateralUsd, setCollateralUsd] = useState<USD>(usd(0));
  const [leverage, setLeverage] = useState(5);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);

  // ─── Handlers ───────────────────────────────────────────
  const handleCollateralChange = useCallback((value: USD) => {
    setCollateralUsd(value);
  }, []);

  const handleLeverageChange = useCallback((value: number) => {
    const maxLev = MARKETS[market].maxLeverage;
    const next = Math.min(Math.max(1, value), maxLev);
    setLeverage(next);
  }, [market]);

  const maxLeverage = MARKETS[market].maxLeverage;
  const sizeUsdDisplay = calculatePositionSize(collateralUsd, leverage);
  const markPx = priceData?.last ? Number(priceData.last) : 0;
  const sizeTokenApprox =
    markPx > 0 ? sizeUsdDisplay / markPx : 0;

  const allocationPct =
    balance > 0 ? Math.min(100, Math.round((collateralUsd / balance) * 100)) : 0;

  const handleAllocationPct = useCallback(
    (pct: number) => {
      const clamped = Math.min(100, Math.max(0, pct));
      setCollateralUsd(usd((balance * clamped) / 100));
    },
    [balance],
  );

  const handleSubmit = useCallback(
    (position: Position) => {
      // Lock collateral (deduct from available balance)
      // GMX deducts full collateral when position opens.
      // Position fee is taken from collateral within the protocol.
      lockCollateral(position.collateralUsd);
      setActivePosition(position);
    },
    [lockCollateral, setActivePosition],
  );

  const handleStatusChange = useCallback(
    (status: import("@/types").OrderStatus) => {
      setOrderStatus(status);
    },
    [setOrderStatus],
  );

  const handleResultDismiss = useCallback(() => {
    dismissOrderResult(); // filled/failed/cancelled → idle, back to form
  }, [dismissOrderResult]);

  // ─── Show Liquidation Screen if position was just liquidated ──
  if (recentLiquidation) {
    return (
      <LiquidationScreen
        trade={recentLiquidation}
        prices={prices}
        onDismiss={handleLiquidationDismiss}
      />
    );
  }

  if (manualCloseNeedsDismiss) {
    return (
      <ClosedTradeResultCard trade={lastTrade} onDismiss={handleResultDismiss} />
    );
  }

  // ─── Already have a position — show Position Card + Close Form ──
  if (hasActivePosition) {
    return (
      <>
        <PositionCard
          position={activePosition}
          prices={prices}
          marketInfo={marketInfo}
        />
        <ClosePositionForm
          position={activePosition}
          prices={prices}
          marketInfo={marketInfo}
        />
      </>
    );
  }

  // ─── Keeper wait screen (replaces form during execution) ──
  if (isKeeperPhase(orderStatus)) {
    return (
      <KeeperWaitScreen
        direction={direction}
        collateralUsd={collateralUsd}
        leverage={leverage}
        market={market}
        orderStatus={orderStatus}
        simulateKeeperDelay={simulateKeeperDelay}
        onSubmit={handleSubmit}
      />
    );
  }

  // ─── Order result screen (filled/failed/cancelled) ────
  // filled = position opened successfully, user needs to dismiss to see PositionCard
  // failed/cancelled = order did not complete, user dismisses to retry
  if (orderStatus === "filled" || orderStatus === "failed" || orderStatus === "cancelled") {
    return (
      <OrderResultScreen
        resultType={orderStatus === "filled" ? "filled" : orderStatus === "failed" ? "failed" : "cancelled"}
        direction={direction}
        collateralUsd={collateralUsd}
        leverage={leverage}
        market={market}
        onDismiss={handleResultDismiss}
      />
    );
  }

  // ─── Form is disabled during wallet/approval/signing flow ───
  // At this point in the code, orderStatus is one of:
  // idle, failed, cancelled, approving, approved, signing, submitted, keeper_step_*, filled
  // The form should only be interactive when idle (or after early returns handled above)
  const formDisabled = orderStatus !== "idle";

  return (
    <>
      <div className="space-y-4">
        {/* GMX-style controls: leverage, pool, collateral token */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <label
              htmlFor="trade-leverage-select"
              className="mb-1 block text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted"
            >
              Leverage
            </label>
            <select
              id="trade-leverage-select"
              value={leverage}
              disabled={formDisabled}
              onChange={(e) =>
                handleLeverageChange(parseInt(e.target.value, 10))
              }
              className="w-full rounded-md border border-trade-border-subtle bg-trade-raised px-2 py-2 text-[length:var(--text-trade-body)] font-semibold text-text-primary focus:border-trade-border-active focus:outline-none"
            >
              {Array.from({ length: maxLeverage }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}x
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="mb-1 block text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted">
              Pool
            </span>
            <div className="flex h-[38px] items-center rounded-md border border-trade-border-subtle bg-trade-panel px-2 text-[length:var(--text-trade-body)] font-semibold text-text-primary">
              {MARKETS[market].symbol}-USDC
            </div>
          </div>
          <div>
            <span className="mb-1 block text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted">
              Collateral
            </span>
            <div className="flex h-[38px] items-center rounded-md border border-trade-border-subtle bg-trade-panel px-2 text-[length:var(--text-trade-body)] font-semibold text-text-primary">
              USDC
            </div>
          </div>
        </div>

        <TutorialTooltip
          tutorialKey="trade-form"
          title="Set up your trade"
          description="Choose Long or Short, then margin and leverage — same idea as GMX. PaperGMX simulates execution with oracle prices and keeper steps."
          position="left"
        >
          <div className="space-y-3">
            <SegmentedControl<OrderDirection | "swap">
              options={TRADE_MODE_OPTIONS}
              value={direction}
              onChange={(v) => {
                if (v === "long" || v === "short") setDirection(v);
              }}
              disabled={formDisabled}
            />

            <div className="flex gap-1 rounded-md border border-trade-border-subtle bg-trade-panel p-0.5">
              <button
                type="button"
                disabled={formDisabled}
                className="flex-1 rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold text-text-primary ring-1 ring-trade-border-active"
              >
                Market
              </button>
              <button
                type="button"
                disabled
                title="Limit orders are not simulated yet"
                className="flex-1 cursor-not-allowed rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold text-text-muted opacity-40"
              >
                Limit
              </button>
              <button
                type="button"
                disabled
                title="Coming soon"
                className="flex-1 cursor-not-allowed rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold text-text-muted opacity-40"
              >
                More
              </button>
            </div>

            <CollateralInput
              label="Margin"
              inputId="margin-input-trade"
              value={collateralUsd}
              balance={balance}
              onChange={handleCollateralChange}
              disabled={formDisabled}
            />

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted">
                  Size
                </span>
                <span className="text-[length:var(--text-trade-label)] text-text-muted">
                  USD
                </span>
              </div>
              <div className="rounded-md border border-trade-border-subtle bg-trade-panel px-3 py-2 text-[length:var(--text-trade-body)] font-semibold tabular-nums text-text-primary">
                {formatUSD(sizeUsdDisplay)}
                {markPx > 0 && (
                  <span className="ml-2 font-normal text-text-muted">
                    ≈{" "}
                    {formatPrice(sizeTokenApprox, MARKETS[market].decimals)}{" "}
                    {MARKETS[market].symbol}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="mb-1 flex justify-between text-[length:var(--text-trade-label)] text-text-muted">
                <span>Margin allocation</span>
                <span className="tabular-nums">{allocationPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={allocationPct}
                disabled={formDisabled || balance <= 0}
                onChange={(e) =>
                  handleAllocationPct(parseInt(e.target.value, 10))
                }
                className="h-2 w-full cursor-pointer appearance-none rounded-full bg-trade-border-subtle accent-blue-primary disabled:opacity-40"
                aria-label="Margin allocation percent of balance"
              />
              <div className="mt-1 flex justify-between text-[length:var(--text-trade-label)] text-text-muted">
                <span>0%</span>
                <span>25%</span>
                <span>50%</span>
                <span>75%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-trade-border-subtle bg-trade-raised/40 px-3 py-2">
              <span className="text-[length:var(--text-trade-body)] font-medium text-text-secondary">
                Take-profit / Stop-loss
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={tpSlEnabled}
                disabled={formDisabled}
                onClick={() => setTpSlEnabled((v) => !v)}
                className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                  tpSlEnabled ? "bg-blue-primary" : "bg-trade-border"
                } disabled:opacity-40`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                    tpSlEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            {tpSlEnabled && (
              <p className="rounded-md border border-dashed border-trade-border-active bg-trade-panel px-3 py-2 text-[length:var(--text-trade-body)] text-text-muted">
                TP/SL controls are not simulated yet — layout mirrors GMX for practice.
              </p>
            )}
          </div>
        </TutorialTooltip>

        <OrderSummary
          direction={direction}
          collateralUsd={collateralUsd}
          leverage={leverage}
          market={market}
          priceData={priceData}
          marketInfo={info}
        />

        {/* Submit Button */}
        <TutorialTooltip
          tutorialKey="submit-order"
          title="Submit your order"
          description="This simulates the full GMX V2 trading flow: wallet approval (first time only) → order signing → keeper execution. No real crypto is used — it's all simulated! If you enable One-Click Trading, you can skip the approval popups."
          position="top"
        >
          <div>
            <SubmitOrderButton
              direction={direction}
              collateralUsd={collateralUsd}
              leverage={leverage}
              market={market}
              balance={balance}
              orderStatus={orderStatus}
              priceData={priceData}
              connectionStatus={connectionStatus}
              needsApproval={needsApproval}
              onStatusChange={handleStatusChange}
            />
          </div>
        </TutorialTooltip>
      </div>

      {/* ─── Wallet Popup Layer ──────────────────────────── */}
      <WalletOverlay visible={wallet.isVisible} />

      <WalletAnimator visible={wallet.isVisible}>
        {wallet.showApproval ? (
          <ApprovalPopup
            processing={wallet.processing}
            onApprove={wallet.handleApprove}
            onReject={wallet.handleRejectApproval}
          />
        ) : wallet.showSigning ? (
          <SigningPopup
            direction={direction}
            collateralUsd={collateralUsd}
            leverage={leverage}
            market={market}
            priceData={priceData}
            marketInfo={info}
            processing={wallet.processing}
            onConfirm={wallet.handleConfirm}
            onReject={wallet.handleRejectSigning}
          />
        ) : null}
      </WalletAnimator>
    </>
  );
}

export const OrderEntryForm = memo(OrderEntryFormInner);
export default OrderEntryForm;
