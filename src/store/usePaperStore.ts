"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  PaperStoreState,
  Position,
  ClosedTrade,
  TradingMode,
  OrderStatus,
} from "@/types";
import {
  DEFAULT_BALANCE,
  ONE_CLICK_MAX_ACTIONS,
  ONE_CLICK_DURATION_DAYS,
} from "@/lib/constants";

const initialState = {
  // Wallet
  balance: DEFAULT_BALANCE,
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
    activatedAt: null as number | null,
    actionsRemaining: ONE_CLICK_MAX_ACTIONS,
    expiresAt: null as number | null,
  },

  // UI
  settingsOpen: false,
};

export const usePaperStore = create<PaperStoreState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Wallet Actions ─────────────────────────────
      initializeBalance: (amount: number) =>
        set({
          balance: amount,
          isInitialized: true,
          approvedTokens: [],
          activePosition: null,
          orderStatus: "idle",
          tradeHistory: [],
          tutorialEnabled: true,
          tutorialDismissed: {},
          tradingMode: "classic",
          showPnlAfterFees: true,
          simulateKeeperDelay: true,
          oneClickTrading: {
            enabled: false,
            activatedAt: null,
            actionsRemaining: ONE_CLICK_MAX_ACTIONS,
            expiresAt: null,
          },
        }),

      topUpBalance: (amount: number) =>
        set((state) => ({
          balance: state.balance + amount,
        })),

      resetWallet: () =>
        set({
          ...initialState,
          isInitialized: false,
        }),

      approveToken: (token: string) =>
        set((state) => ({
          approvedTokens: state.approvedTokens.includes(token)
            ? state.approvedTokens
            : [...state.approvedTokens, token],
        })),

      // ─── Position Actions ───────────────────────────
      setActivePosition: (position: Position | null) =>
        set({ activePosition: position }),

      setOrderStatus: (status: OrderStatus) => set({ orderStatus: status }),

      updatePositionFees: (borrowFeeDelta: number, fundingFeeDelta: number) =>
        set((state) => {
          if (!state.activePosition) return state;
          return {
            activePosition: {
              ...state.activePosition,
              borrowFeeAccrued:
                state.activePosition.borrowFeeAccrued + borrowFeeDelta,
              fundingFeeAccrued:
                state.activePosition.fundingFeeAccrued + fundingFeeDelta,
            },
          };
        }),

      closePosition: (exitPrice: number, closeReason: ClosedTrade["closeReason"]) =>
        set((state) => {
          if (!state.activePosition) return state;

          const pos = state.activePosition;
          const directionMultiplier = pos.direction === "long" ? 1 : -1;
          const grossPnl =
            directionMultiplier *
            ((exitPrice - pos.entryPrice) / pos.entryPrice) *
            pos.sizeUsd;
          const positionFeeClose =
            pos.sizeUsd * 0.0004; // Will be dynamically calculated later
          const netPnl =
            grossPnl -
            pos.positionFeePaid -
            positionFeeClose -
            pos.borrowFeeAccrued -
            pos.fundingFeeAccrued;
          const returnedCollateral = pos.collateralUsd + netPnl;

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
            positionFeeClose,
            borrowFeeTotal: pos.borrowFeeAccrued,
            fundingFeeTotal: pos.fundingFeeAccrued,
            netPnl,
            grossPnl,
            openedAt: pos.openedAt,
            closedAt: Date.now(),
            closeReason,
          };

          return {
            activePosition: null,
            orderStatus: "idle" as OrderStatus,
            balance: state.balance + Math.max(0, returnedCollateral),
            tradeHistory: [closedTrade, ...state.tradeHistory],
          };
        }),

      addClosedTrade: (trade: ClosedTrade) =>
        set((state) => ({
          tradeHistory: [trade, ...state.tradeHistory],
        })),

      // ─── Settings Actions ───────────────────────────
      setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),

      setTutorialEnabled: (enabled: boolean) =>
        set({ tutorialEnabled: enabled }),

      dismissTutorial: (key: string) =>
        set((state) => ({
          tutorialDismissed: { ...state.tutorialDismissed, [key]: true },
        })),

      setTradingMode: (mode: TradingMode) => set({ tradingMode: mode }),

      setShowPnlAfterFees: (show: boolean) =>
        set({ showPnlAfterFees: show }),

      setSimulateKeeperDelay: (simulate: boolean) =>
        set({ simulateKeeperDelay: simulate }),

      // ─── 1CT Actions ───────────────────────────────
      enableOneClickTrading: () =>
        set({
          oneClickTrading: {
            enabled: true,
            activatedAt: Date.now(),
            actionsRemaining: ONE_CLICK_MAX_ACTIONS,
            expiresAt:
              Date.now() + ONE_CLICK_DURATION_DAYS * 24 * 60 * 60 * 1000,
          },
        }),

      disableOneClickTrading: () =>
        set({
          oneClickTrading: {
            enabled: false,
            activatedAt: null,
            actionsRemaining: ONE_CLICK_MAX_ACTIONS,
            expiresAt: null,
          },
        }),

      decrementOneClickActions: () =>
        set((state) => ({
          oneClickTrading: {
            ...state.oneClickTrading,
            actionsRemaining: Math.max(
              0,
              state.oneClickTrading.actionsRemaining - 1
            ),
          },
        })),

      renewOneClickTrading: () =>
        set({
          oneClickTrading: {
            enabled: true,
            activatedAt: Date.now(),
            actionsRemaining: ONE_CLICK_MAX_ACTIONS,
            expiresAt:
              Date.now() + ONE_CLICK_DURATION_DAYS * 24 * 60 * 60 * 1000,
          },
        }),
    }),
    {
      name: "papergmx-storage",
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
    }
  )
);
