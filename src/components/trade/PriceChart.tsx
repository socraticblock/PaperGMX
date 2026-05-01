"use client";

import { memo, useEffect, useRef, useCallback, useState } from "react";
import { createChart, LineSeries, ColorType } from "lightweight-charts";
import type {
  IChartApi,
  ISeriesApi,
  DeepPartial,
  ChartOptions,
  UTCTimestamp,
} from "lightweight-charts";
import type { MarketSlug, PriceData } from "@/types";
import { TopTabs, Panel, IconButton } from "@/components/trade/ui";
import { ArrowsPointingOutIcon, ChartBarIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface PriceChartProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
}

const CHART_TABS = [
  { id: "price", label: "Price" },
  { id: "depth", label: "Depth", disabled: true },
  { id: "net-rate", label: "Net Rate", disabled: true },
] as const;

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"] as const;

const MAX_HISTORY_LENGTH = 200;

interface PricePoint {
  time: UTCTimestamp;
  value: number;
}

/** Match `trade-panel` token for visual continuity with the shell. */
const CHART_SURFACE = "#12141a";

const CHART_THEME = {
  background: CHART_SURFACE,
  text: "#8a8f98",
  gridLines: "#23262f",
  lineColor: "#418cf5",
  crosshairLabelBg: "#2a2f3a",
  crosshairLine: "#3d4451",
} as const;

// ─── Component ────────────────────────────────────────────

function PriceChartInner({ market, priceData }: PriceChartProps) {
  const [chartTab, setChartTab] = useState<(typeof CHART_TABS)[number]["id"]>(
    "price",
  );
  const [timeframe, setTimeframe] = useState<(typeof TIMEFRAMES)[number]>("5m");

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const historyRef = useRef<PricePoint[]>([]);
  const lastTimeRef = useRef<UTCTimestamp>(0 as UTCTimestamp);

  useEffect(() => {
    if (!containerRef.current || chartTab !== "price") return;

    const chartOptions: DeepPartial<ChartOptions> = {
      layout: {
        background: { type: ColorType.Solid, color: CHART_THEME.background },
        textColor: CHART_THEME.text,
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: CHART_THEME.gridLines },
        horzLines: { color: CHART_THEME.gridLines },
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: CHART_THEME.crosshairLine,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_THEME.crosshairLabelBg,
        },
        horzLine: {
          color: CHART_THEME.crosshairLine,
          width: 1,
          style: 2,
          labelBackgroundColor: CHART_THEME.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.gridLines,
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: CHART_THEME.gridLines,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    };

    const chart = createChart(containerRef.current, chartOptions);
    chartRef.current = chart;

    const lineSeries = chart.addSeries(LineSeries, {
      color: CHART_THEME.lineColor,
      lineWidth: 2,
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      crosshairMarkerBorderColor: CHART_THEME.lineColor,
      crosshairMarkerBackgroundColor: CHART_THEME.background,
      lastPriceAnimation: 2,
    });

    seriesRef.current = lineSeries;

    if (historyRef.current.length > 0) {
      lineSeries.setData(historyRef.current);
    }
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [chartTab]);

  useEffect(() => {
    historyRef.current = [];
    lastTimeRef.current = 0 as UTCTimestamp;
    if (seriesRef.current) {
      seriesRef.current.setData([]);
    }
    if (chartRef.current) {
      chartRef.current.timeScale().fitContent();
    }
  }, [market]);

  const updatePrice = useCallback((price: number) => {
    if (!seriesRef.current) return;
    if (price <= 0 || !Number.isFinite(price)) return;

    const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;
    const time: UTCTimestamp =
      nowSec > lastTimeRef.current ? nowSec : ((lastTimeRef.current + 1) as UTCTimestamp);
    lastTimeRef.current = time;

    const point: PricePoint = { time, value: price };
    historyRef.current.push(point);
    if (historyRef.current.length > MAX_HISTORY_LENGTH) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY_LENGTH);
    }
    seriesRef.current.update(point);
  }, []);

  useEffect(() => {
    if (chartTab !== "price") return;
    if (priceData?.last && priceData.last > 0) {
      updatePrice(priceData.last as number);
    }
  }, [chartTab, priceData, updatePrice]);

  return (
    <Panel padding="none" className="overflow-hidden">
      <TopTabs
        tabs={CHART_TABS}
        activeId={chartTab}
        onChange={(id) => setChartTab(id as typeof chartTab)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-trade-border-subtle px-3 py-2 md:px-4">
        <div
          role="radiogroup"
          aria-label="Chart timeframe"
          className="flex flex-wrap items-center gap-1"
        >
          {TIMEFRAMES.map((tf) => {
            const active = timeframe === tf;
            return (
              <button
                key={tf}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2 py-1 text-[length:var(--text-trade-label)] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-trade-raised text-text-primary ring-1 ring-trade-border-active"
                    : "text-text-muted hover:bg-trade-raised/60 hover:text-text-secondary"
                }`}
              >
                {tf}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <IconButton aria-label="Chart layout" title="Chart layout (placeholder)">
            <ChartBarIcon className="h-4 w-4" aria-hidden />
          </IconButton>
          <IconButton aria-label="Full screen chart" title="Full screen (placeholder)">
            <ArrowsPointingOutIcon className="h-4 w-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      {chartTab === "price" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-trade-border-subtle px-3 py-2 md:px-4">
            <div className="flex items-center gap-2">
              <span className="text-[length:var(--text-trade-label)] uppercase tracking-wide text-text-muted">
                Oracle
              </span>
              <span className="inline-block h-1.5 w-1.5 animate-pulse-glow rounded-full bg-blue-primary" />
            </div>
            {priceData && (
              <div className="flex flex-wrap items-center gap-3 text-[length:var(--text-trade-label)] text-text-muted">
                <div className="tabular-nums">
                  <span className="text-text-muted">Low</span>{" "}
                  <span className="text-text-secondary">
                    ${(priceData.min as number).toFixed(2)}
                  </span>
                </div>
                <div className="tabular-nums">
                  <span className="text-text-muted">High</span>{" "}
                  <span className="text-text-secondary">
                    ${(priceData.max as number).toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div
            ref={containerRef}
            className="w-full"
            style={{ minHeight: "420px", height: "min(52vh, 560px)" }}
          />
        </>
      )}

      {chartTab !== "price" && (
        <div
          className="flex items-center justify-center px-4 text-center text-[length:var(--text-trade-body)] text-text-muted"
          style={{ minHeight: "420px", height: "min(52vh, 560px)" }}
        >
          This view is not wired to simulator data yet.
        </div>
      )}
    </Panel>
  );
}

export const PriceChart = memo(PriceChartInner);
export default PriceChart;
