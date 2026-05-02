import type { UTCTimestamp } from "lightweight-charts";
import type { MarketSlug } from "@/types";

/** Binance USDT spot pair per market (chart proxy — same index as GMX UI uses for charts). */
export const CHART_BINANCE_SYMBOL: Record<MarketSlug, string> = {
  eth: "ETHUSDT",
  btc: "BTCUSDT",
  sol: "SOLUSDT",
  arb: "ARBUSDT",
};

export const CHART_INTERVALS = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;

export type ChartInterval = (typeof CHART_INTERVALS)[number];

export interface ParsedKlineCandle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ParsedKlineVolume {
  time: UTCTimestamp;
  value: number;
  color: string;
}

const UP_VOL = "rgba(38, 166, 154, 0.5)";
const DOWN_VOL = "rgba(239, 83, 80, 0.5)";

/** Binance kline row: [ openTime, open, high, low, close, volume, ... ] */
export function parseBinanceKlineRows(raw: unknown): {
  candles: ParsedKlineCandle[];
  volumes: ParsedKlineVolume[];
} {
  if (!Array.isArray(raw)) {
    return { candles: [], volumes: [] };
  }

  const candles: ParsedKlineCandle[] = [];
  const volumes: ParsedKlineVolume[] = [];

  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;

    const openMs = Number(row[0]);
    const open = parseFloat(String(row[1]));
    const high = parseFloat(String(row[2]));
    const low = parseFloat(String(row[3]));
    const close = parseFloat(String(row[4]));
    const vol = parseFloat(String(row[5]));

    if (
      !Number.isFinite(openMs) ||
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue;
    }

    const time = Math.floor(openMs / 1000) as UTCTimestamp;
    candles.push({ time, open, high, low, close });
    const up = close >= open;
    volumes.push({
      time,
      value: Number.isFinite(vol) ? vol : 0,
      color: up ? UP_VOL : DOWN_VOL,
    });
  }

  return { candles, volumes };
}

/** Current candle open time (seconds) for Binance interval strings. */
export function currentBucketStart(interval: ChartInterval, nowMs = Date.now()): number {
  const sec = Math.floor(nowMs / 1000);
  const step: Record<ChartInterval, number> = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "1h": 3600,
    "4h": 14400,
    "1d": 86400,
  };
  const d = step[interval];
  return Math.floor(sec / d) * d;
}
