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
import { usd, timestamp, addUSD, subUSD } from "@/lib/branded";
import { isValidTransition } from "@/types";
import { validateBalanceAmount } from "@/lib/validation";
import { calculateClosePosition } from "@/lib/calculations";
import {
  ONE_CLICK_MAX_ACTIONS,
  ONE_CLICK_DURATION_DAYS,
} from "@/lib/constants";

// ─── Initial State ────────────────────────────────────────

const initialState = {
  // Wallet
  balance: usd(0),
  isInitialized: false,
  approvedTokens: [] as string[],

  // Position
  activePosition: null as Position | null,
  orderStatus: "idle" as OrderStatus,

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

const STORE_VERSION = 1;

function migrateStore(
  persistedState: unknown,
  version: number,
): Partial<PaperStoreState> {
  if (version === 0) {
    // Future: migrate from v0 to v1
  }
  // Basic shape validation — don't blindly cast corrupted data
  if (typeof persistedState !== "object" || persistedState === null) return {};
  return persistedState as Partial<PaperStoreState>;
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
        setActivePosition: (position: Position | null) =>
          set({ activePosition: position }, false, "setActivePosition"),

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

        updatePositionFees: (borrowFeeDelta: USD, fundingFeeDelta: USD) =>
          set(
            (state) => {
              if (!state.activePosition) return state;
              return {
                activePosition: {
                  ...state.activePosition,
                  borrowFeeAccrued: addUSD(
                    state.activePosition.borrowFeeAccrued, borrowFeeDelta,
                  ),
                  fundingFeeAccrued: addUSD(
                    state.activePosition.fundingFeeAccrued, fundingFeeDelta,
                  ),
                },
              };
            },
            false,
            "updatePositionFees",
          ),

        closePosition: (
          exitPrice: Price,
          closeReason: ClosedTrade["closeReason"],
          closeFeeBpsOverride?: BPS,
        ) =>
          set(
            (state) => {
              if (!state.activePosition) return state;

              const pos = state.activePosition;

              // GMX V2: close fee BPS is determined at close time based on OI
              // balance, not from the open-time snapshot. The caller should
              // compute the close fee BPS using determinePositionFeeBps() and
              // pass it via closeFeeBpsOverride. Falls back to the stored
              // positionFeeBps if not provided (backward-compatible).
              const closeFeeBps = closeFeeBpsOverride ?? pos.positionFeeBps;

              // Use pure calculation function — single source of truth
              // For liquidation: GMX V2 full-liquidation semantics — all collateral forfeited
              const isLiquidation = closeReason === "liquidated";
              const result = calculateClosePosition(
                pos.direction,
                pos.entryPrice,
                exitPrice,
                pos.sizeUsd,
                pos.collateralUsd,
                pos.positionFeePaid,
                closeFeeBps,
                pos.borrowFeeAccrued,
                pos.fundingFeeAccrued,
                isLiquidation,
              );

              const closedTrade: ClosedTrade = {
                id: pos.id,
                market: pos.market,
                direction: pos.direction,
                leverage: pos.leverage,
                sizeUsd: pos.sizeUsd,
                entryPrice: pos.entryPrice,
                exitPrice,
                collateralUsd: pos.collateralUsd,
                positionFeeOpen: pos.positionFeePaid,
                positionFeeClose: result.positionFeeClose,
                borrowFeeTotal: result.borrowFeeTotal,
                fundingFeeTotal: result.fundingFeeTotal,
                netPnl: result.netPnl,
                grossPnl: result.grossPnl,
                openedAt: pos.openedAt,
                closedAt: timestamp(Date.now()),
                closeReason,
              };

              return {
                activePosition: null,
                // NOTE: orderStatus is NOT reset here — the caller (useCloseKeeper)
                // manages the state machine transition via setOrderStatus.
                // Previously this set orderStatus: "idle" which bypassed the
                // state machine and blocked the subsequent "filled" transition.
                balance: addUSD(state.balance, result.returnedCollateral),
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
            // Fix stuck "confirming" positions from prior sessions.
            // The confirmation timeout (2-3s in useKeeperExecution) doesn't
            // survive page reloads, leaving positions permanently stuck in
            // "confirming" with no fee accrual or liquidation protection.
            if (state.activePosition?.status === "confirming") {
              state.activePosition = {
                ...state.activePosition,
                status: "active",
                confirmedAt: timestamp(state.activePosition.openedAt),
              };
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
          activePosition: state.activePosition,
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
