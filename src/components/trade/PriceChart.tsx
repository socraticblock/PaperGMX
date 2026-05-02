"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineStyle,
  createChart,
} from "lightweight-charts";
import type {
  CandlestickData,
  HistogramData,
  IChartApi,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";
import type { MarketSlug, PriceData } from "@/types";
import {
  CHART_BINANCE_SYMBOL,
  CHART_INTERVALS,
  type ChartInterval,
  currentBucketStart,
  parseBinanceKlineRows,
} from "@/lib/trade/chartKlines";
import { IconButton, Panel, TopTabs } from "@/components/trade/ui";
import { ChartBarSquareIcon } from "@heroicons/react/24/outline";

// ─── Types ────────────────────────────────────────────────

export interface PriceChartProps {
  market: MarketSlug;
  priceData: PriceData | undefined;
  /** Optional position overlay — oracle/sim execution vs chart feed may differ. */
  positionOverlay?: {
    entryPrice: number;
    liquidationPrice: number | null;
  } | null;
}

const CHART_TABS = [
  { id: "price", label: "Price" },
  { id: "depth", label: "Depth", disabled: true },
  { id: "netRate", label: "Net rate", disabled: true },
] as const;

const CHART_BG = "#0c0e14";
const GRID = "#1e2230";

// ─── Component ────────────────────────────────────────────

function PriceChartInner({
  market,
  priceData,
  positionOverlay,
}: PriceChartProps) {
  const [interval, setInterval] = useState<ChartInterval>("5m");
  const [loadError, setLoadError] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesBufRef = useRef<CandlestickData[]>([]);
  const priceLinesRef = useRef<ReturnType<ISeriesApi<"Candlestick">["createPriceLine"]>[]>(
    [],
  );

  const loadKlines = useCallback(async () => {
    const symbol = CHART_BINANCE_SYMBOL[market];
    const res = await fetch(
      `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=500`,
    );
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const raw: unknown = await res.json();
    const { candles, volumes } = parseBinanceKlineRows(raw);
    const candleData = candles as CandlestickData[];
    candlesBufRef.current = candleData;
    candleRef.current?.setData(candleData);
    volumeRef.current?.setData(volumes as HistogramData[]);
    chartRef.current?.timeScale().fitContent();
  }, [market, interval]);

  // ─── Chart bootstrap ─────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_BG },
        textColor: "#8a8f98",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: GRID },
        horzLines: { color: GRID },
      },
      crosshair: {
        vertLine: { color: "#3a3a4e", labelBackgroundColor: "#2a2a3e" },
        horzLine: { color: "#3a3a4e", labelBackgroundColor: "#2a2a3e" },
      },
      rightPriceScale: {
        borderColor: GRID,
      },
      timeScale: {
        borderColor: GRID,
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#089981",
      downColor: "#f23645",
      borderUpColor: "#089981",
      borderDownColor: "#f23645",
      wickUpColor: "#089981",
      wickDownColor: "#f23645",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
      color: "#26a69a",
    });

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.75, bottom: 0 },
    });
    candleSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.22 },
    });

    chartRef.current = chart;
    candleRef.current = candleSeries;
    volumeRef.current = volumeSeries;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      candlesBufRef.current = [];
      priceLinesRef.current = [];
    };
  }, []);

  // ─── Load / reload OHLCV ─────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await loadKlines();
        if (!cancelled) setLoadError(null);
      } catch {
        if (!cancelled) setLoadError("Could not load candles.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadKlines]);

  // ─── Merge live mark price into forming candle ───────────
  useEffect(() => {
    const series = candleRef.current;
    const lastPx = priceData?.last;
    if (!series || lastPx === undefined || lastPx <= 0) return;

    const p = Number(lastPx);
    const bucket = currentBucketStart(interval) as UTCTimestamp;
    const buf = candlesBufRef.current;
    if (buf.length === 0) return;

    const last = buf[buf.length - 1];
    if (!last) return;
    if (last.time === bucket) {
      const next: CandlestickData = {
        time: last.time,
        open: last.open,
        high: Math.max(last.high, p),
        low: Math.min(last.low, p),
        close: p,
      };
      buf[buf.length - 1] = next;
      series.update(next);
    } else if ((last.time as number) < bucket) {
      const open = last.close;
      const next: CandlestickData = {
        time: bucket,
        open,
        high: Math.max(open, p),
        low: Math.min(open, p),
        close: p,
      };
      buf.push(next);
      candlesBufRef.current = buf;
      series.update(next);
      volumeRef.current?.update({
        time: bucket,
        value: 0,
        color: p >= open ? "rgba(38, 166, 154, 0.35)" : "rgba(239, 83, 80, 0.35)",
      });
    }
  }, [priceData?.last, interval]);

  // ─── Entry / liquidation lines ───────────────────────────
  useEffect(() => {
    const series = candleRef.current;
    if (!series) return;

    for (const line of priceLinesRef.current) {
      series.removePriceLine(line);
    }
    priceLinesRef.current = [];

    if (!positionOverlay) return;

    const pl: typeof priceLinesRef.current = [];
    pl.push(
      series.createPriceLine({
        price: positionOverlay.entryPrice,
        color: "#418cf5",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "Entry",
      }),
    );

    const liq = positionOverlay.liquidationPrice;
    if (liq != null && liq > 0 && Number.isFinite(liq)) {
      pl.push(
        series.createPriceLine({
          price: liq,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: "Liq.",
        }),
      );
    }
    priceLinesRef.current = pl;
  }, [positionOverlay]);

  return (
    <Panel padding="none" className="overflow-hidden">
      <TopTabs tabs={CHART_TABS} activeId="price" />

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-trade-border-subtle bg-trade-strip px-2 py-1.5 md:px-3">
        <div
          className="flex flex-wrap items-center gap-1"
          role="toolbar"
          aria-label="Chart interval"
        >
          {CHART_INTERVALS.map((iv) => {
            const active = interval === iv;
            return (
              <button
                key={iv}
                type="button"
                onClick={() => setInterval(iv)}
                className={`rounded px-2 py-1 text-[length:var(--text-trade-label)] font-semibold uppercase tracking-wide transition-colors ${
                  active
                    ? "bg-trade-raised text-text-primary ring-1 ring-trade-border-active"
                    : "text-text-muted hover:bg-trade-raised/70 hover:text-text-secondary"
                }`}
              >
                {iv}
              </button>
            );
          })}
        </div>
        <IconButton
          type="button"
          aria-label="Indicators (coming soon)"
          title="Indicators"
          disabled
          className="opacity-50"
        >
          <ChartBarSquareIcon className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>

      <div className="relative border-b border-trade-border-subtle px-3 py-2 md:px-4">
        <p className="text-[length:var(--text-trade-label)] text-text-muted">
          <span className="text-text-secondary">{CHART_BINANCE_SYMBOL[market]}</span>
          {" · "}
          Binance spot candles (visual). Execution uses your oracle / simulator prices.
        </p>
      </div>

      {loadError ? (
        <div
          className="flex items-center justify-center bg-trade-panel px-4 py-16 text-center text-[length:var(--text-trade-body)] text-red-primary"
          style={{ minHeight: "min(56vh, 620px)" }}
        >
          {loadError}
        </div>
      ) : (
        <div
          ref={wrapRef}
          className="w-full"
          style={{ minHeight: "min(56vh, 620px)", height: "min(56vh, 620px)" }}
        />
      )}
    </Panel>
  );
}

export const PriceChart = memo(PriceChartInner);
export default PriceChart;
