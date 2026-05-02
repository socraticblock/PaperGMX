"use client";

import { memo, useEffect, useRef } from "react";
import type { MarketSlug, PriceData } from "@/types";
import { Panel } from "@/components/trade/ui";

// ─── Types ────────────────────────────────────────────────

export interface PriceChartProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
}

const TV_SYMBOL_BY_MARKET: Record<MarketSlug, string> = {
  btc: "BINANCE:BTCUSDT",
  eth: "BINANCE:ETHUSDT",
  sol: "BINANCE:SOLUSDT",
  arb: "BINANCE:ARBUSDT",
};

// ─── Component ────────────────────────────────────────────

function PriceChartInner({ market }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container";
    widget.style.height = "500px";
    widget.style.width = "100%";

    const widgetInner = document.createElement("div");
    widgetInner.className = "tradingview-widget-container__widget";
    widgetInner.style.height = "calc(100% - 0px)";
    widgetInner.style.width = "100%";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;

    const symbol = TV_SYMBOL_BY_MARKET[market];
    script.text = JSON.stringify({
      autosize: true,
      symbol,
      interval: "5",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      withdateranges: true,
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    widget.appendChild(widgetInner);
    widget.appendChild(script);
    container.appendChild(widget);

    return () => {
      container.innerHTML = "";
    };
  }, [market]);

  return (
    <Panel padding="none" className="overflow-hidden">
      <div ref={containerRef} className="w-full" style={{ minHeight: "500px", height: "500px" }} />
    </Panel>
  );
}

export const PriceChart = memo(PriceChartInner);
export default PriceChart;
