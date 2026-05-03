import { NextRequest, NextResponse } from "next/server";

/**
 * Binance rejects many datacenter requests without a browser-like UA.
 * Some regions also respond better to alternate hosts or Binance.US for spot klines.
 */
const UPSTREAM_HEADERS: HeadersInit = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (compatible; PaperGMX/1.0; +https://github.com/socraticblock/PaperGMX)",
};

/** Try in order — include Binance.US because Vercel (often US egress) can be blocked on .com. */
const BINANCE_API_HOSTS = [
  "https://api.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api.binance.us",
] as const;

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

/** Always fetch fresh klines (Vercel edge caching otherwise can stick on failures). */
export const dynamic = "force-dynamic";

/** Node runtime — Edge fetch to Binance is flakier from some regions. */
export const runtime = "nodejs";

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

  const query = `symbol=${encodeURIComponent(symbolRaw)}&interval=${encodeURIComponent(interval)}&limit=${limit}`;

  function isBinanceErrorPayload(data: unknown): boolean {
    return (
      typeof data === "object" &&
      data !== null &&
      "code" in data &&
      "msg" in data &&
      typeof (data as { code?: unknown }).code === "number"
    );
  }

  for (const host of BINANCE_API_HOSTS) {
    const url = `${host}/api/v3/klines?${query}`;
    try {
      const res = await fetch(url, {
        headers: UPSTREAM_HEADERS,
        cache: "no-store",
      });

      if (!res.ok) continue;

      const data: unknown = await res.json();
      if (isBinanceErrorPayload(data)) continue;
      if (!Array.isArray(data) || data.length === 0) continue;

      return NextResponse.json(data);
    } catch {
      continue;
    }
  }

  return NextResponse.json(
    { error: "Upstream fetch failed (all Binance hosts)" },
    { status: 502 },
  );
}
