"use client";

import { memo, useEffect, useRef, useCallback } from "react";
import { createChart, LineSeries, ColorType } from "lightweight-charts";
import type { IChartApi, ISeriesApi, DeepPartial, ChartOptions, UTCTimestamp } from "lightweight-charts";
import type { MarketSlug, PriceData } from "@/types";

// ─── Types ────────────────────────────────────────────────

export interface PriceChartProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
}

// ─── Chart Theme Constants ────────────────────────────────

const CHART_THEME = {
  background: "#0c0e14",
  text: "#8a8f98",
  gridLines: "#1e2230",
  lineColor: "#418cf5",
  crosshairLabelBg: "#2a2a3e",
  crosshairLine: "#3a3a4e",
} as const;

const MAX_HISTORY_LENGTH = 200;

// ─── Price data point for the chart ───────────────────────

interface PricePoint {
  time: UTCTimestamp;
  value: number;
}

// ─── Component ────────────────────────────────────────────

function PriceChartInner({ market, priceData }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const historyRef = useRef<PricePoint[]>([]);
  const lastTimeRef = useRef<UTCTimestamp>(0 as UTCTimestamp);

  // ─── Initialize chart ────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

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
        mode: 0, // Normal
        vertLine: {
          color: CHART_THEME.crosshairLine,
          width: 1,
          style: 2, // Dashed
          labelBackgroundColor: CHART_THEME.crosshairLabelBg,
        },
        horzLine: {
          color: CHART_THEME.crosshairLine,
          width: 1,
          style: 2, // Dashed
          labelBackgroundColor: CHART_THEME.crosshairLabelBg,
        },
      },
      rightPriceScale: {
        borderColor: CHART_THEME.gridLines,
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: CHART_THEME.gridLines,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: {
        vertTouchDrag: false,
      },
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
      lastPriceAnimation: 2, // OnDataUpdate
    });

    seriesRef.current = lineSeries;

    // Set existing history data on the series
    if (historyRef.current.length > 0) {
      lineSeries.setData(historyRef.current);
    }

    // Fit content after initial data
    chart.timeScale().fitContent();

    // Handle resize with ResizeObserver
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
  }, []);

  // ─── Reset history when market changes ───────────────────
  useEffect(() => {
    historyRef.current = [];
    lastTimeRef.current = 0 as UTCTimestamp;
  }, [market]);

  // ─── Update chart data when priceData changes ────────────
  const updatePrice = useCallback((price: number) => {
    if (!seriesRef.current) return;
    if (price <= 0 || !Number.isFinite(price)) return;

    const nowSec = Math.floor(Date.now() / 1000) as UTCTimestamp;

    // Avoid duplicate timestamps — lightweight-charts requires strictly increasing time
    const time: UTCTimestamp = (nowSec > lastTimeRef.current)
      ? nowSec
      : ((lastTimeRef.current + 1) as UTCTimestamp);
    lastTimeRef.current = time;

    const point: PricePoint = { time, value: price };

    // Append to history buffer
    historyRef.current.push(point);
    if (historyRef.current.length > MAX_HISTORY_LENGTH) {
      historyRef.current = historyRef.current.slice(-MAX_HISTORY_LENGTH);
    }

    // Update series with new data point
    seriesRef.current.update(point);
  }, []);

  // Effect: push price data when it changes
  useEffect(() => {
    if (priceData?.last && priceData.last > 0) {
      updatePrice(priceData.last as number);
    }
  }, [priceData, updatePrice]);

  return (
    <div className="rounded-xl border border-border-primary bg-bg-card overflow-hidden">
      {/* Chart header */}
      <div className="flex items-center justify-between border-b border-border-primary px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-secondary">Oracle Price</span>
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-primary animate-pulse-glow" />
        </div>
        {priceData && (
          <div className="flex items-center gap-3 text-[10px] text-text-muted">
            <div>
              <span className="text-text-secondary">Min:</span>{" "}
              <span className="text-text-primary tabular-nums">
                ${(priceData.min as number).toFixed(2)}
              </span>
            </div>
            <div>
              <span className="text-text-secondary">Max:</span>{" "}
              <span className="text-text-primary tabular-nums">
                ${(priceData.max as number).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Chart canvas container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ minHeight: "500px", height: "500px" }}
      />
    </div>
  );
}

export const PriceChart = memo(PriceChartInner);
export default PriceChart;
