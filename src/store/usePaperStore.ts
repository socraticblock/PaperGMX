"use client";

import { create } from "zustand";
import { persist, devtools } from "zustand/middleware";
import type {
  PaperStoreState,
  Position,
  ClosedTrade,
  TradingMode,
  OrderStatus,
  USD,
  Price,
  BPS,
  Timestamp,
  MarketSlug,
  PriceData,
  MarketInfo,
  ApiConnectionStatus,
} from "@/types";
import { usd, price, timestamp, addUSD, subUSD } from "@/lib/branded";
import { isValidTransition } from "@/types";
import { validateBalanceAmount } from "@/lib/validation";
import {
  calculateCloseSettlement,
  getMaxPnlFactorForTraders,
} from "@/lib/positionEngine";
import { calculateLiquidationPrice } from "@/lib/calculations";
import { MARKETS } from "@/lib/constants";
import {
  ONE_CLICK_MAX_ACTIONS,
  ONE_CLICK_DURATION_DAYS,
} from "@/lib/constants";
import {
  normalizeEpochMs,
  resolveFeeAccrualFromMs,
} from "@/lib/feeAccrualTime";

// ─── Initial State ────────────────────────────────────────

const initialState = {
  // Wallet
  balance: usd(0),
  isInitialized: false,
  approvedTokens: [] as string[],

  // Positions (multi-position model — see PaperStoreState for details)
  positions: [] as Position[],
  selectedPositionId: null as string | null,
  orderStatus: "idle" as OrderStatus,
  closeOrderStatus: "idle" as OrderStatus,

  // History
  tradeHistory: [] as ClosedTrade[],

  // Settings
  tutorialEnabled: true,
  tutorialDismissed: {} as Record<string, boolean>,
  tradingMode: "classic" as TradingMode,
  showPnlAfterFees: true,
  simulateKeeperDelay: true,

  // 1CT
  oneClickTrading: {
    enabled: false,
    activatedAt: null as Timestamp | null,
    actionsRemaining: ONE_CLICK_MAX_ACTIONS,
    expiresAt: null as Timestamp | null,
  },

  // UI
  settingsOpen: false,

  // Prices (not persisted — always fresh from API)
  prices: {} as Record<MarketSlug, PriceData>,
  marketInfo: {} as Record<MarketSlug, MarketInfo>,
  connectionStatus: "disconnected" as ApiConnectionStatus,
  pricesLoaded: false,
};

// ─── Store Version (for migrations) ───────────────────────

const STORE_VERSION = 5;

/**
 * Internal-only legacy shape carried by versions ≤ 3 of the persisted state.
 * After migration there is no `activePosition` field on PaperStoreState.
 */
type LegacyV3State = Partial<PaperStoreState> & {
  activePosition?: Position | null;
};

export function migrateStore(
  persistedState: unknown,
  version: number,
): Partial<PaperStoreState> {
  if (typeof persistedState !== "object" || persistedState === null) return {};
  const state = persistedState as LegacyV3State;

  if ((version ?? 0) < 2 && state.activePosition) {
    const pos = state.activePosition;
    if (pos.lastFeeAccrualAt === undefined) {
      state.activePosition = {
        ...pos,
        lastFeeAccrualAt: pos.openedAt,
      };
    }
  }

  if ((version ?? 0) < 3 && state.activePosition) {
    const pos = state.activePosition;
    try {
      const openedNum = Number(pos.openedAt);
      const openedMs = normalizeEpochMs(openedNum);
      if (Number.isFinite(openedMs) && openedMs > 0) {
        const accrualFrom = resolveFeeAccrualFromMs(
          openedNum,
          pos.lastFeeAccrualAt != null
            ? Number(pos.lastFeeAccrualAt)
            : undefined,
        );
        state.activePosition = {
          ...pos,
          openedAt: timestamp(openedMs),
          lastFeeAccrualAt: timestamp(accrualFrom),
          confirmedAt:
            pos.confirmedAt != null
              ? timestamp(normalizeEpochMs(Number(pos.confirmedAt)))
              : null,
        };
      }
    } catch {
      /* leave position unchanged if timestamps are invalid */
    }
  }

  // v3 → v4: collapse the single `activePosition` slot into a `positions[]`
  // array so the store can hold multiple concurrent positions (matches GMX V2).
  if ((version ?? 0) < 4) {
    const ap = state.activePosition ?? null;
    state.positions = ap ? [ap] : [];
    state.selectedPositionId = ap?.id ?? null;
    delete state.activePosition;
  }

  // v4 → v5: separate close-order state machine from entry (open/increase).
  if ((version ?? 0) < 5) {
    const s = state as Partial<PaperStoreState> & {
      closeOrderStatus?: OrderStatus;
    };
    if (s.closeOrderStatus === undefined) {
      s.closeOrderStatus = "idle";
    }
  }

  return state;
}

// ─── Store ────────────────────────────────────────────────

export const usePaperStore = create<PaperStoreState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ─── Wallet Actions ─────────────────────────────
        initializeBalance: (amount: number) => {
          const validated = validateBalanceAmount(amount, "initial balance");
          set(
            {
              ...initialState,
              balance: validated,
              isInitialized: true,
            },
            false,
            "initializeBalance",
          );
        },

        topUpBalance: (amount: number) => {
          const validated = validateBalanceAmount(amount, "top-up amount");
          set(
            (state) => ({
              balance: addUSD(state.balance, validated),
            }),
            false,
            "topUpBalance",
          );
        },

        resetWallet: () => {
          set({ ...initialState, isInitialized: false }, false, "resetWallet");
        },

        approveToken: (token: string) =>
          set(
            (state) => ({
              approvedTokens: state.approvedTokens.includes(token)
                ? state.approvedTokens
                : [...state.approvedTokens, token],
            }),
            false,
            "approveToken",
          ),

        // ─── Position Actions ───────────────────────────
        addPosition: (position: Position) =>
          set(
            (state) => ({
              positions: [...state.positions, position],
              selectedPositionId:
                state.selectedPositionId ?? position.id,
            }),
            false,
            "addPosition",
          ),

        updatePosition: (id: string, patch: Partial<Position>) =>
          set(
            (state) => {
              if (!state.positions.some((p) => p.id === id)) return state;
              return {
                positions: state.positions.map((p) =>
                  p.id === id ? { ...p, ...patch } : p,
                ),
              };
            },
            false,
            "updatePosition",
          ),

        removePosition: (id: string) =>
          set(
            (state) => {
              const remaining = state.positions.filter((p) => p.id !== id);
              if (remaining.length === state.positions.length) return state;
              const nextSelected =
                state.selectedPositionId === id
                  ? (remaining[0]?.id ?? null)
                  : state.selectedPositionId;
              return {
                positions: remaining,
                selectedPositionId: nextSelected,
              };
            },
            false,
            "removePosition",
          ),

        selectPosition: (id: string | null) =>
          set({ selectedPositionId: id }, false, "selectPosition"),

        increasePosition: (
          id: string,
          args: {
            sizeDeltaUsd: USD;
            collateralDeltaUsd: USD;
            executionPrice: Price;
            openFeeUsd: USD;
            now: Timestamp;
          },
        ) =>
          set(
            (state) => {
              const idx = state.positions.findIndex((p) => p.id === id);
              if (idx < 0) return state;
              const p = state.positions[idx]!;

              // GMX-style weighted-average entry:
              //   sizeUsd'        = sizeUsd + sizeDeltaUsd
              //   sizeInTokens'   = sizeInTokens + (sizeDeltaUsd / executionPrice)
              //   entryPrice'     = sizeUsd' / sizeInTokens'   (implicit)
              //
              // Mirrors PositionUtils.getExecutionPriceForIncrease in
              // gmx-synthetics, with price impact assumed to be zero (we don't
              // simulate price impact yet).
              const tokensDelta = args.sizeDeltaUsd / args.executionPrice;
              const existingTokens =
                p.sizeInTokens ?? p.sizeUsd / p.entryPrice;
              const nextSizeUsd = (p.sizeUsd as number) + args.sizeDeltaUsd;
              const nextSizeInTokens = existingTokens + tokensDelta;

              if (nextSizeInTokens <= 0) {
                console.warn(
                  "[PaperGMX] increasePosition produced non-positive sizeInTokens — ignoring",
                );
                return state;
              }

              const nextEntryPrice = price(nextSizeUsd / nextSizeInTokens);
              const nextCollateralUsd = usd(
                Math.max(
                  0,
                  (p.collateralUsd as number) +
                    args.collateralDeltaUsd -
                    args.openFeeUsd,
                ),
              );
              const nextLeverage =
                nextCollateralUsd > 0
                  ? nextSizeUsd / nextCollateralUsd
                  : p.leverage;
              const nextPositionFeePaid = usd(
                (p.positionFeePaid as number) + args.openFeeUsd,
              );

              const marketConfig = MARKETS[p.market];
              const nextLiqPrice = calculateLiquidationPrice(
                p.direction,
                nextEntryPrice,
                nextCollateralUsd,
                usd(nextSizeUsd),
                marketConfig.maintenanceMarginBps,
                marketConfig.liquidationFeeBps,
                nextPositionFeePaid,
                addUSD(p.borrowFeeAccrued, p.fundingFeeAccrued),
              );

              const nextPosition: Position = {
                ...p,
                sizeUsd: usd(nextSizeUsd),
                sizeInTokens: nextSizeInTokens,
                entryPrice: nextEntryPrice,
                collateralUsd: nextCollateralUsd,
                leverage: nextLeverage,
                positionFeePaid: nextPositionFeePaid,
                liquidationPrice: nextLiqPrice,
                // Reset accrual checkpoint: we're treating the increase as a
                // settlement boundary. Caller (useFeeAccrual / increase flow)
                // should ensure pending borrow/funding has already been
                // applied to the position before increase is called.
                lastFeeAccrualAt: args.now,
                // Increase keeps the position active; never demote to confirming.
                status: p.status === "confirming" ? "active" : p.status,
                confirmedAt: p.confirmedAt ?? args.now,
              };

              const nextPositions = [...state.positions];
              nextPositions[idx] = nextPosition;
              return { positions: nextPositions };
            },
            false,
            "increasePosition",
          ),

        lockCollateral: (amount: USD) =>
          set(
            (state) => {
              if (amount > state.balance) {
                console.warn(
                  `[PaperGMX] Cannot lock $${amount} — balance is $${state.balance}`,
                );
                return state; // No change
              }
              return { balance: subUSD(state.balance, amount) };
            },
            false,
            "lockCollateral",
          ),

        setOrderStatus: (status: OrderStatus) => {
          const current = get().orderStatus;
          // Block invalid transitions — state machine is enforced
          // Valid transitions are defined in ORDER_TRANSITIONS (src/types/index.ts)
          if (!isValidTransition(current, status)) {
            console.warn(
              `[PaperGMX] Blocked invalid transition: ${current} → ${status}`,
            );
            return; // Do NOT apply the transition
          }
          set({ orderStatus: status }, false, "setOrderStatus");

          // GMX V2 1CT: decrement the action quota when the order fills.
          // This MUST happen in the store (not in a useEffect on a form
          // component) because the form component can unmount before the
          // order fills (e.g., replaced by KeeperWaitScreen during keeper
          // execution). Doing it here guarantees the decrement regardless
          // of which React component tree is currently rendered.
          if (status === "filled") {
            const state = get();
            if (state.tradingMode === "1ct" && state.oneClickTrading.enabled) {
              get().decrementOneClickActions();
            }
          }
        },

        dismissOrderResult: () => {
          // Transition from a terminal state (filled/failed/cancelled) back to idle.
          // Uses setOrderStatus to go through the state machine — the transition
          // must be valid per ORDER_TRANSITIONS, otherwise it's a no-op.
          const current = get().orderStatus;
          if (!isValidTransition(current, "idle")) {
            console.warn(
              `[PaperGMX] dismissOrderResult: cannot dismiss from ${current}`,
            );
            return;
          }
          set({ orderStatus: "idle" as OrderStatus }, false, "dismissOrderResult");
        },

        setCloseOrderStatus: (status: OrderStatus) => {
          const current = get().closeOrderStatus;
          if (!isValidTransition(current, status)) {
            console.warn(
              `[PaperGMX] Blocked invalid close transition: ${current} → ${status}`,
            );
            return;
          }
          set(
            { closeOrderStatus: status },
            false,
            "setCloseOrderStatus",
          );
          if (status === "filled") {
            const s = get();
            if (s.tradingMode === "1ct" && s.oneClickTrading.enabled) {
              get().decrementOneClickActions();
            }
          }
        },

        dismissCloseOrderResult: () => {
          const current = get().closeOrderStatus;
          if (!isValidTransition(current, "idle")) {
            console.warn(
              `[PaperGMX] dismissCloseOrderResult: cannot dismiss from ${current}`,
            );
            return;
          }
          set(
            { closeOrderStatus: "idle" as OrderStatus },
            false,
            "dismissCloseOrderResult",
          );
        },

        updatePositionFees: (
          id: string,
          borrowFeeDelta: USD,
          fundingFeeDelta: USD,
          accrualEndAt?: Timestamp,
        ) =>
          set(
            (state) => {
              const idx = state.positions.findIndex((p) => p.id === id);
              if (idx < 0) return state;
              const endAt = accrualEndAt ?? timestamp(Date.now());
              const target = state.positions[idx]!;
              const next: Position = {
                ...target,
                borrowFeeAccrued: addUSD(
                  target.borrowFeeAccrued,
                  borrowFeeDelta,
                ),
                fundingFeeAccrued: addUSD(
                  target.fundingFeeAccrued,
                  fundingFeeDelta,
                ),
                lastFeeAccrualAt: endAt,
              };
              const positions = [...state.positions];
              positions[idx] = next;
              return { positions };
            },
            false,
            "updatePositionFees",
          ),

        closePosition: (
          id: string,
          exitPrice: Price,
          closeReason: ClosedTrade["closeReason"],
          closeFeeBpsOverride?: BPS,
        ) =>
          set(
            (state) => {
              const idx = state.positions.findIndex((p) => p.id === id);
              if (idx < 0) return state;
              const pos = state.positions[idx]!;

              // GMX V2: close fee BPS is determined at close time based on OI
              // balance, not from the open-time snapshot. The caller should
              // compute the close fee BPS using determinePositionFeeBps() and
              // pass it via closeFeeBpsOverride. Falls back to the stored
              // positionFeeBps if not provided (backward-compatible).
              const closeFeeBps = closeFeeBpsOverride ?? pos.positionFeeBps;

              // GMX V2 waterfall settlement: PnL cap → PnL realize →
              // funding → borrow → close fee → floor at zero.
              const marketInfoEntry = state.marketInfo[pos.market];
              const maxPnlFactor = getMaxPnlFactorForTraders(marketInfoEntry);

              const settlement = calculateCloseSettlement(
                pos.direction,
                pos.entryPrice,
                exitPrice,
                pos.sizeUsd,
                pos.collateralUsd,
                pos.positionFeePaid,
                closeFeeBps,
                pos.borrowFeeAccrued,
                pos.fundingFeeAccrued,
                maxPnlFactor,
                pos.sizeInTokens,
              );

              const closedTrade: ClosedTrade = {
                id: pos.id,
                market: pos.market,
                direction: pos.direction,
                leverage: pos.leverage,
                sizeUsd: pos.sizeUsd,
                sizeInTokens: pos.sizeInTokens,
                entryPrice: pos.entryPrice,
                exitPrice,
                collateralUsd: pos.collateralUsd,
                positionFeeOpen: pos.positionFeePaid,
                positionFeeClose: settlement.positionFeeClose,
                borrowFeeTotal: settlement.borrowFeeTotal,
                fundingFeeTotal: settlement.fundingFeeTotal,
                netPnl: settlement.netPnl,
                grossPnl: settlement.grossPnl,
                grossPnlUncapped: settlement.grossPnlUncapped,
                pnlCappedAmount: settlement.pnlCappedAmount,
                returnedCollateral: settlement.returnedCollateral,
                openedAt: pos.openedAt,
                closedAt: timestamp(Date.now()),
                closeReason,
              };

              const remaining = state.positions.filter((p) => p.id !== id);
              const nextSelected =
                state.selectedPositionId === id
                  ? (remaining[0]?.id ?? null)
                  : state.selectedPositionId;

              return {
                positions: remaining,
                selectedPositionId: nextSelected,
                // NOTE: orderStatus is NOT reset here — the caller (useCloseKeeper)
                // manages the state machine transition via setOrderStatus.
                balance: addUSD(state.balance, settlement.returnedCollateral),
                tradeHistory: [closedTrade, ...state.tradeHistory].slice(0, 100),
              };
            },
            false,
            "closePosition",
          ),

        addClosedTrade: (trade: ClosedTrade) =>
          set(
            (state) => ({
              tradeHistory: [trade, ...state.tradeHistory].slice(0, 100),
            }),
            false,
            "addClosedTrade",
          ),

        // ─── Settings Actions ───────────────────────────
        setSettingsOpen: (open: boolean) =>
          set({ settingsOpen: open }, false, "setSettingsOpen"),

        setTutorialEnabled: (enabled: boolean) =>
          set({ tutorialEnabled: enabled }, false, "setTutorialEnabled"),

        dismissTutorial: (key: string) =>
          set(
            (state) => ({
              tutorialDismissed: { ...state.tutorialDismissed, [key]: true },
            }),
            false,
            "dismissTutorial",
          ),

        setTradingMode: (mode: TradingMode) =>
          set({ tradingMode: mode }, false, "setTradingMode"),

        setShowPnlAfterFees: (show: boolean) =>
          set({ showPnlAfterFees: show }, false, "setShowPnlAfterFees"),

        setSimulateKeeperDelay: (simulate: boolean) =>
          set(
            { simulateKeeperDelay: simulate },
            false,
            "setSimulateKeeperDelay",
          ),

        // ─── 1CT Actions ───────────────────────────────
        enableOneClickTrading: () =>
          set(
            {
              oneClickTrading: {
                enabled: true,
                activatedAt: timestamp(Date.now()),
                actionsRemaining: ONE_CLICK_MAX_ACTIONS,
                expiresAt: timestamp(
                  Date.now() + ONE_CLICK_DURATION_DAYS * 24 * 60 * 60 * 1000,
                ),
              },
            },
            false,
            "enableOneClickTrading",
          ),

        disableOneClickTrading: () =>
          set(
            {
              oneClickTrading: {
                enabled: false,
                activatedAt: null,
                actionsRemaining: ONE_CLICK_MAX_ACTIONS,
                expiresAt: null,
              },
            },
            false,
            "disableOneClickTrading",
          ),

        decrementOneClickActions: () =>
          set(
            (state) => ({
              oneClickTrading: {
                ...state.oneClickTrading,
                actionsRemaining: Math.max(
                  0,
                  state.oneClickTrading.actionsRemaining - 1,
                ),
              },
            }),
            false,
            "decrementOneClickActions",
          ),

        renewOneClickTrading: () =>
          set(
            {
              oneClickTrading: {
                enabled: true,
                activatedAt: timestamp(Date.now()),
                actionsRemaining: ONE_CLICK_MAX_ACTIONS,
                expiresAt: timestamp(
                  Date.now() + ONE_CLICK_DURATION_DAYS * 24 * 60 * 60 * 1000,
                ),
              },
            },
            false,
            "renewOneClickTrading",
          ),

        // ─── Price Actions ─────────────────────────────
        setPrices: (prices: Record<MarketSlug, PriceData>) =>
          set({ prices, pricesLoaded: true }, false, "setPrices"),

        setMarketInfo: (info: Record<MarketSlug, MarketInfo>) =>
          set({ marketInfo: info }, false, "setMarketInfo"),

        setConnectionStatus: (status: ApiConnectionStatus) =>
          set({ connectionStatus: status }, false, "setConnectionStatus"),
      }),
      {
        name: "papergmx-storage",
        version: STORE_VERSION,
        migrate: migrateStore,
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error("[PaperGMX] Failed to rehydrate state:", error);
          }
          if (state) {
            if (!Number.isFinite(state.balance)) {
              console.warn("[PaperGMX] Corrupted balance detected, resetting");
              state.balance = usd(0);
              state.isInitialized = false;
            }

            // Defensive default: migration from v3 should have populated this,
            // but a hand-edited / corrupted persistent blob could omit it.
            if (!Array.isArray(state.positions)) {
              state.positions = [];
            }
            if (state.selectedPositionId === undefined) {
              state.selectedPositionId = state.positions[0]?.id ?? null;
            }

            // Repair each position. Two issues to fix:
            //   1) `confirming` positions whose 2-3s confirmation timeout
            //      was lost across the page reload — auto-promote to active.
            //   2) Implausibly large accrued borrow/funding from a buggy
            //      checkpoint (e.g. lastFeeAccrualAt=0). Clear and restart.
            state.positions = state.positions.map((pos) => {
              let next: Position = pos;

              if (next.status === "confirming") {
                const openedNum = Number(next.openedAt);
                const lastCheckpoint = resolveFeeAccrualFromMs(
                  openedNum,
                  next.lastFeeAccrualAt != null
                    ? Number(next.lastFeeAccrualAt)
                    : undefined,
                );
                next = {
                  ...next,
                  status: "active",
                  confirmedAt: timestamp(normalizeEpochMs(openedNum)),
                  lastFeeAccrualAt: timestamp(lastCheckpoint),
                };
              }

              if (next.status === "active") {
                const size = Math.abs(Number(next.sizeUsd));
                if (Number.isFinite(size) && size > 0) {
                  const cap = size * 100;
                  const b = Math.abs(Number(next.borrowFeeAccrued));
                  const f = Math.abs(Number(next.fundingFeeAccrued));
                  if (b > cap || f > cap) {
                    console.warn(
                      `[PaperGMX] Cleared implausible accrued borrow/funding for position ${next.id}.`,
                    );
                    next = {
                      ...next,
                      borrowFeeAccrued: usd(0),
                      fundingFeeAccrued: usd(0),
                      lastFeeAccrualAt: timestamp(Date.now()),
                    };
                  }
                }
              }

              return next;
            });

            // If selectedPositionId points at a position that no longer exists
            // (manual edit / corrupted blob), fall back to the first one.
            if (
              state.selectedPositionId &&
              !state.positions.some((p) => p.id === state.selectedPositionId)
            ) {
              state.selectedPositionId = state.positions[0]?.id ?? null;
            }

            // Enforce 1CT expiry on rehydration. If the persisted session
            // has expired between visits, disable it so the user can't trade
            // with an expired 1CT session.
            if (state.oneClickTrading.enabled && state.oneClickTrading.expiresAt) {
              if (state.oneClickTrading.expiresAt < Date.now()) {
                state.oneClickTrading = {
                  enabled: false,
                  activatedAt: null,
                  actionsRemaining: ONE_CLICK_MAX_ACTIONS,
                  expiresAt: null,
                };
              }
            }
          }
        },
        partialize: (state) => ({
          balance: state.balance,
          isInitialized: state.isInitialized,
          approvedTokens: state.approvedTokens,
          positions: state.positions,
          selectedPositionId: state.selectedPositionId,
          tradeHistory: state.tradeHistory,
          tutorialEnabled: state.tutorialEnabled,
          tutorialDismissed: state.tutorialDismissed,
          tradingMode: state.tradingMode,
          showPnlAfterFees: state.showPnlAfterFees,
          simulateKeeperDelay: state.simulateKeeperDelay,
          oneClickTrading: state.oneClickTrading,
        }),
      },
    ),
    { name: "PaperGMX", enabled: process.env.NODE_ENV === "development" },
  ),
);
