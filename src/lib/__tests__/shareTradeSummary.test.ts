import { describe, it, expect } from "vitest";
import { formatClosedTradeShareText } from "@/lib/shareTradeSummary";
import type { ClosedTrade } from "@/types";
import { usd, price, timestamp } from "@/lib/branded";

function mockTrade(over: Partial<ClosedTrade> = {}): ClosedTrade {
  return {
    id: "eth-long-1",
    market: "eth",
    direction: "long",
    leverage: 10,
    sizeUsd: usd(5000),
    entryPrice: price(3000),
    exitPrice: price(3100),
    collateralUsd: usd(500),
    positionFeeOpen: usd(2),
    positionFeeClose: usd(2),
    borrowFeeTotal: usd(0.5),
    fundingFeeTotal: usd(0.1),
    netPnl: usd(95.4),
    grossPnl: usd(100),
    grossPnlUncapped: usd(100),
    pnlCappedAmount: usd(0),
    returnedCollateral: usd(595.4),
    openedAt: timestamp(Date.now() - 3600_000),
    closedAt: timestamp(Date.now()),
    closeReason: "take_profit",
    ...over,
  };
}

describe("formatClosedTradeShareText", () => {
  it("includes market, side, leverage, and net P&L", () => {
    const text = formatClosedTradeShareText(mockTrade());
    expect(text).toContain("PaperGMX");
    expect(text).toContain("ETH");
    expect(text).toContain("Long");
    expect(text).toContain("10x");
    expect(text).toContain("Net P&L:");
    expect(text).toContain("SIMULATION");
  });

  it("labels liquidated closes", () => {
    const text = formatClosedTradeShareText(
      mockTrade({ closeReason: "liquidated", netPnl: usd(-400) }),
    );
    expect(text).toContain("Liquidated");
  });
});
