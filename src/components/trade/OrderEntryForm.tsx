"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePaperStore } from "@/store/usePaperStore";
import { useShallow } from "zustand/react/shallow";
import type {
  EntryOrderType,
  OrderDirection,
  MarketSlug,
  Price,
  USD,
} from "@/types";
import type { SegmentOption } from "./ui/SegmentedControl";
import { price, usd } from "@/lib/branded";
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
import { LiquidationScreen } from "@/components/position/LiquidationScreen";
import { ClosedTradeResultCard } from "@/components/position/ClosedTradeResultCard";
import { TutorialTooltip } from "@/components/tutorial/TutorialTooltip";
import type { KeeperFillResult } from "@/hooks/useKeeperExecution";

// ─── Types ────────────────────────────────────────────────

export interface OrderEntryFormProps {
  market: MarketSlug;
}

// ─── Helper: is order in keeper phase? ────────────────────

const TRADE_MODE_OPTIONS = [
  { value: "long", label: "Long", tone: "long" as const },
  { value: "short", label: "Short", tone: "short" as const },
] as const satisfies readonly SegmentOption<OrderDirection>[];

const TP_SL_PCTS = [25, 50, 75, 100] as const;

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
    positions,
    orderStatus,
    prices,
    marketInfo,
    connectionStatus,
    simulateKeeperDelay,
    lockCollateral,
    addPosition,
    increasePosition,
    setOrderStatus,
    dismissOrderResult,
  } = usePaperStore(
    useShallow((s) => ({
      balance: s.balance,
      positions: s.positions,
      orderStatus: s.orderStatus,
      prices: s.prices,
      marketInfo: s.marketInfo,
      connectionStatus: s.connectionStatus,
      simulateKeeperDelay: s.simulateKeeperDelay,
      lockCollateral: s.lockCollateral,
      addPosition: s.addPosition,
      increasePosition: s.increasePosition,
      setOrderStatus: s.setOrderStatus,
      dismissOrderResult: s.dismissOrderResult,
    })),
  );

  // ─── Wallet simulation hook ─────────────────────────────
  const wallet = useWalletSimulation("entry");

  // ─── Derived data ───────────────────────────────────────
  const priceData = prices[market];
  const info = marketInfo[market];

  // ─── Multi-position fee accrual + liquidation watch ─────
  // These hooks loop over every active position in the store, so they live
  // here at the top of the trade UI even when the trade box is rendering
  // an interim state (keeper wait, order result).
  useLiquidationChecker(positions, prices);
  useFeeAccrual(positions, prices);

  // ─── Trade history for liquidation popup detection ───────
  const tradeHistory = usePaperStore(useShallow((s) => s.tradeHistory));

  // ─── Liquidation screen state ────────────────────────────
  // Track dismissed liquidation trade IDs so the screen doesn't re-show
  const [dismissedLiquidationIds, setDismissedLiquidationIds] = useState<
    Set<string>
  >(() => new Set());

  // Show the most recent liquidation that hasn't been dismissed yet —
  // works regardless of how many other positions are still open.
  const lastTrade = tradeHistory.length > 0 ? tradeHistory[0] : null;
  const recentLiquidation =
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

  /**
   * "Manual close needs dismiss" only applies to closes triggered from this
   * form — those happen via ClosePositionForm now, which is rendered inside
   * PositionsList. The OrderResultScreen below handles open/increase results.
   * We keep this dismiss path for liquidations the form needs to surface.
   */
  const manualCloseNeedsDismiss =
    orderStatus === "filled" &&
    lastTrade != null &&
    lastTrade.closeReason !== "liquidated";

  // ─── Local form state ───────────────────────────────────
  const [direction, setDirection] = useState<OrderDirection>("long");
  const [collateralUsd, setCollateralUsd] = useState<USD>(usd(0));
  const [leverage, setLeverage] = useState(5);
  const [tpSlEnabled, setTpSlEnabled] = useState(false);
  const [entryOrderType, setEntryOrderType] =
    useState<EntryOrderType>("market");
  const [moreOpen, setMoreOpen] = useState(false);
  const [limitPriceInput, setLimitPriceInput] = useState("");
  const [tpPriceInput, setTpPriceInput] = useState("");
  const [slPriceInput, setSlPriceInput] = useState("");
  const [tpClosePct, setTpClosePct] = useState<(typeof TP_SL_PCTS)[number]>(100);
  const [slClosePct, setSlClosePct] = useState<(typeof TP_SL_PCTS)[number]>(100);

  const limitEntryPrice = useMemo(() => {
    if (entryOrderType !== "limit") return null;
    const raw = limitPriceInput.trim().replace(/,/g, "");
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return price(n);
    } catch {
      return null;
    }
  }, [entryOrderType, limitPriceInput]);

  const tpTriggerPrice = useMemo<Price | null>(() => {
    const raw = tpPriceInput.trim().replace(/,/g, "");
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return price(n);
    } catch {
      return null;
    }
  }, [tpPriceInput]);

  const slTriggerPrice = useMemo<Price | null>(() => {
    const raw = slPriceInput.trim().replace(/,/g, "");
    if (!raw) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;
    try {
      return price(n);
    } catch {
      return null;
    }
  }, [slPriceInput]);

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
  const refPxForSize =
    entryOrderType === "limit" && limitEntryPrice != null
      ? Number(limitEntryPrice)
      : markPx;
  const sizeTokenApprox =
    refPxForSize > 0 ? sizeUsdDisplay / refPxForSize : 0;

  const allocationPct =
    balance > 0 ? Math.min(100, Math.round((collateralUsd / balance) * 100)) : 0;

  // ─── Existing-position lookup (drives Open vs Increase) ────
  // GMX position key = (account, market, collateralToken, isLong). PaperGMX
  // is single-user and v1 is USDC-only collateral, so account and
  // collateralToken are implicit — the effective key is (market, direction).
  const existingPosition = useMemo(
    () =>
      positions.find(
        (p) =>
          p.market === market &&
          p.direction === direction &&
          p.status !== "closed" &&
          p.status !== "liquidated",
      ) ?? null,
    [positions, market, direction],
  );
  const isIncrease = existingPosition !== null;

  /** Same market already has the opposite side open — user may be opening the second leg (GMX-style hedge). */
  const oppositeDirection: OrderDirection =
    direction === "long" ? "short" : "long";
  const hasOppositeSideOpenOnMarket = useMemo(
    () =>
      positions.some(
        (p) =>
          p.market === market &&
          p.direction === oppositeDirection &&
          p.status !== "closed" &&
          p.status !== "liquidated",
      ),
    [positions, market, oppositeDirection],
  );
  const showSameMarketSecondSideHint =
    hasOppositeSideOpenOnMarket && !existingPosition;

  const handleAllocationPct = useCallback(
    (pct: number) => {
      const clamped = Math.min(100, Math.max(0, pct));
      setCollateralUsd(usd((balance * clamped) / 100));
    },
    [balance],
  );

  const handleSubmit = useCallback(
    (result: KeeperFillResult) => {
      // Lock collateral (deduct from available balance) before mutating the
      // position list. GMX deducts full collateral when the position opens
      // or increases; position fee is taken from collateral by the protocol.
      if (result.kind === "open") {
        lockCollateral(result.position.collateralUsd);
        addPosition(result.position);
      } else {
        lockCollateral(result.collateralDeltaUsd);
        increasePosition(result.positionId, {
          sizeDeltaUsd: result.sizeDeltaUsd,
          collateralDeltaUsd: result.collateralDeltaUsd,
          executionPrice: result.executionPrice,
          openFeeUsd: result.openFeeUsd,
          now: result.now,
        });
      }
    },
    [lockCollateral, addPosition, increasePosition],
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
            <span className="mb-1 flex items-center gap-1 text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted">
              Collateral
              <span
                title="PaperGMX v1 uses USDC collateral. Real GMX V2 also lets you collateralize with the index token (e.g. ETH for ETH-USD). PnL math is the same; non-stable collateral just adds the collateral token's price exposure on top of the position."
                className="cursor-help text-[9px] text-text-muted/70"
                aria-label="Why USDC only"
              >
                ⓘ
              </span>
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
            <SegmentedControl<OrderDirection>
              options={TRADE_MODE_OPTIONS}
              value={direction}
              onChange={setDirection}
              disabled={formDisabled}
            />
            {showSameMarketSecondSideHint && (
              <p
                className="text-[length:var(--text-trade-label)] text-text-secondary"
                role="note"
              >
                GMX and PaperGMX keep <span className="text-text-primary">long</span> and{" "}
                <span className="text-text-primary">short</span> as separate
                positions on the same market. This order opens a new{" "}
                {direction === "long" ? "long" : "short"}; your open{" "}
                {oppositeDirection} is unchanged. Use the Long/Short switch
                above — staying on the same side as an open position
                &quot;increases&quot; that leg instead.
              </p>
            )}

            <div className="flex gap-1 rounded-md border border-trade-border-subtle bg-trade-panel p-0.5">
              <button
                type="button"
                disabled={formDisabled}
                onClick={() => setEntryOrderType("market")}
                className={`flex-1 rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold transition-colors ${
                  entryOrderType === "market"
                    ? "text-text-primary ring-1 ring-trade-border-active"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                Market
              </button>
              <button
                type="button"
                disabled
                title="Limit orders coming soon"
                className="flex-1 cursor-not-allowed rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold text-text-muted opacity-70"
              >
                Limit
              </button>
              <div className="relative flex-1">
                <button
                  type="button"
                  disabled={formDisabled}
                  onClick={() => setMoreOpen((v) => !v)}
                  className="w-full rounded py-1.5 text-[length:var(--text-trade-body)] font-semibold text-text-muted transition-colors hover:text-text-secondary disabled:opacity-40"
                >
                  More
                </button>
                <AnimatePresence>
                  {moreOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14, ease: "easeOut" }}
                      className="absolute right-0 z-10 mt-1 w-36 rounded-md border border-trade-border-subtle bg-trade-panel p-1 shadow-lg"
                    >
                      <button
                        type="button"
                        disabled
                        title="Stop Market will be simulated in a later phase"
                        className="w-full cursor-not-allowed rounded px-2 py-1.5 text-left text-[length:var(--text-trade-body)] font-medium text-text-muted opacity-70"
                      >
                        Stop Market
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {false && entryOrderType === "limit" && (
                <motion.div
                  key="limit-price-field"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-1.5"
                >
                  <label
                    htmlFor="limit-price-input"
                    className="block text-[length:var(--text-trade-label)] font-medium uppercase tracking-wide text-text-muted"
                  >
                    Limit price (USD)
                  </label>
                  <input
                    id="limit-price-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={`e.g. ${formatPrice(markPx || 0, MARKETS[market].decimals)}`}
                    disabled={formDisabled}
                    value={limitPriceInput}
                    onChange={(e) => setLimitPriceInput(e.target.value)}
                    className="w-full rounded-md border border-trade-border-subtle bg-trade-raised px-3 py-2 text-[length:var(--text-trade-body)] font-semibold tabular-nums text-text-primary placeholder:text-text-muted focus:border-trade-border-active focus:outline-none"
                  />
                  <p className="text-[length:var(--text-trade-label)] text-text-muted">
                    Preview only — PaperGMX still submits market orders until limit
                    execution is implemented.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

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
            <AnimatePresence initial={false}>
              {tpSlEnabled && (
                <motion.div
                  key="tp-sl-expanded"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="space-y-3"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2 rounded-md border border-trade-border-subtle bg-trade-panel p-3">
                      <p className="text-[length:var(--text-trade-label)] font-semibold uppercase tracking-wide text-green-primary">
                        Take-Profit
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <div>
                          <label
                            htmlFor="tp-price-input"
                            className="mb-1 block text-[length:var(--text-trade-label)] text-text-muted"
                          >
                            Price
                          </label>
                          <input
                            id="tp-price-input"
                            type="text"
                            inputMode="decimal"
                            disabled={formDisabled}
                            value={tpPriceInput}
                            onChange={(e) => setTpPriceInput(e.target.value)}
                            placeholder={
                              markPx > 0
                                ? formatPrice(markPx, MARKETS[market].decimals)
                                : "0.00"
                            }
                            className="w-full rounded-md border border-trade-border-subtle bg-trade-raised px-3 py-2 text-[length:var(--text-trade-body)] font-semibold tabular-nums text-text-primary focus:border-trade-border-active focus:outline-none"
                          />
                        </div>
                        <div className="rounded-md border border-trade-border-subtle bg-trade-raised px-2.5 py-2 text-right">
                          <p className="text-[length:var(--text-trade-label)] text-text-muted">Est.</p>
                          <p className="text-[length:var(--text-trade-body)] font-semibold tabular-nums text-green-primary">
                            Gain: +{formatUSD(0)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {TP_SL_PCTS.map((pct) => (
                          <button
                            key={`tp-${pct}`}
                            type="button"
                            disabled={formDisabled}
                            onClick={() => setTpClosePct(pct)}
                            className={`rounded px-2 py-1 text-[length:var(--text-trade-label)] font-medium tabular-nums transition-colors ${
                              tpClosePct === pct
                                ? "bg-trade-raised text-text-primary ring-1 ring-trade-border-active"
                                : "bg-trade-strip text-text-muted hover:text-text-secondary"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[length:var(--text-trade-label)] text-text-muted">
                        Trigger {tpTriggerPrice ? `$${formatPrice(tpTriggerPrice, MARKETS[market].decimals)}` : "—"} · Close {tpClosePct}%
                      </p>
                    </div>

                    <div className="space-y-2 rounded-md border border-trade-border-subtle bg-trade-panel p-3">
                      <p className="text-[length:var(--text-trade-label)] font-semibold uppercase tracking-wide text-red-primary">
                        Stop-Loss
                      </p>
                      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                        <div>
                          <label
                            htmlFor="sl-price-input"
                            className="mb-1 block text-[length:var(--text-trade-label)] text-text-muted"
                          >
                            Price
                          </label>
                          <input
                            id="sl-price-input"
                            type="text"
                            inputMode="decimal"
                            disabled={formDisabled}
                            value={slPriceInput}
                            onChange={(e) => setSlPriceInput(e.target.value)}
                            placeholder={
                              markPx > 0
                                ? formatPrice(markPx, MARKETS[market].decimals)
                                : "0.00"
                            }
                            className="w-full rounded-md border border-trade-border-subtle bg-trade-raised px-3 py-2 text-[length:var(--text-trade-body)] font-semibold tabular-nums text-text-primary focus:border-trade-border-active focus:outline-none"
                          />
                        </div>
                        <div className="rounded-md border border-trade-border-subtle bg-trade-raised px-2.5 py-2 text-right">
                          <p className="text-[length:var(--text-trade-label)] text-text-muted">Est.</p>
                          <p className="text-[length:var(--text-trade-body)] font-semibold tabular-nums text-red-primary">
                            Loss: -{formatUSD(0)}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1">
                        {TP_SL_PCTS.map((pct) => (
                          <button
                            key={`sl-${pct}`}
                            type="button"
                            disabled={formDisabled}
                            onClick={() => setSlClosePct(pct)}
                            className={`rounded px-2 py-1 text-[length:var(--text-trade-label)] font-medium tabular-nums transition-colors ${
                              slClosePct === pct
                                ? "bg-trade-raised text-text-primary ring-1 ring-trade-border-active"
                                : "bg-trade-strip text-text-muted hover:text-text-secondary"
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                      <p className="text-[length:var(--text-trade-label)] text-text-muted">
                        Trigger {slTriggerPrice ? `$${formatPrice(slTriggerPrice, MARKETS[market].decimals)}` : "—"} · Close {slClosePct}%
                      </p>
                    </div>
                  </div>

                  <p className="rounded-md border border-dashed border-trade-border-active bg-trade-panel px-3 py-2 text-[length:var(--text-trade-body)] text-text-muted">
                    Take profit and stop loss are not simulated yet — layout mirrors
                    GMX for practice.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </TutorialTooltip>

        <OrderSummary
          direction={direction}
          collateralUsd={collateralUsd}
          leverage={leverage}
          market={market}
          priceData={priceData}
          marketInfo={info}
          entryOrderType={entryOrderType}
          limitEntryPrice={limitEntryPrice}
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
              entryOrderType={entryOrderType}
              actionLabel={
                isIncrease
                  ? `Increase ${direction === "long" ? "Long" : "Short"} ${MARKETS[market].symbol}`
                  : undefined
              }
              onStatusChange={handleStatusChange}
            />
          </div>
        </TutorialTooltip>
      </div>

      {/* ─── Wallet Popup Layer ──────────────────────────── */}
      <WalletOverlay visible={false} />

      <WalletAnimator visible={false}>
        {false && wallet.showApproval ? (
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
