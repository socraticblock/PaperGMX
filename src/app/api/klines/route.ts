import { NextRequest, NextResponse } from "next/server";

/** Allowlist: only perp index symbols we use in the UI. */
const ALLOWED_SYMBOLS = new Set([
  "ETHUSDT",
  "BTCUSDT",
  "SOLUSDT",
  "ARBUSDT",
]);

const ALLOWED_INTERVALS = new Set([
  "1m",
  "3m",
  "5m",
  "15m",
  "30m",
  "1h",
  "2h",
  "4h",
  "6h",
  "12h",
  "1d",
  "3d",
  "1w",
  "1M",
]);

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 500;

/**
 * Proxy Binance spot klines (USDT) for the trade chart. Avoids browser CORS.
 * GET /api/klines?symbol=ETHUSDT&interval=5m&limit=500
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbolRaw = (searchParams.get("symbol") ?? "ETHUSDT").toUpperCase();
  const interval = searchParams.get("interval") ?? "5m";
  const limitParam = searchParams.get("limit");

  if (!ALLOWED_SYMBOLS.has(symbolRaw)) {
    return NextResponse.json({ error: "Invalid symbol" }, { status: 400 });
  }
  if (!ALLOWED_INTERVALS.has(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  let limit = DEFAULT_LIMIT;
  if (limitParam) {
    const n = parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n < 2 || n > MAX_LIMIT) {
      return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    limit = n;
  }

  const upstream = new URL("https://api.binance.com/api/v3/klines");
  upstream.searchParams.set("symbol", symbolRaw);
  upstream.searchParams.set("interval", interval);
  upstream.searchParams.set("limit", String(limit));

  try {
    const res = await fetch(upstream.toString(), {
      headers: { Accept: "application/json" },
      next: { revalidate: 10 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream ${res.status}` },
        { status: 502 },
      );
    }

    const data: unknown = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
}
