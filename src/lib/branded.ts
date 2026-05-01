// ─── Branded Types for Financial Safety ───────────────────
// These prevent mixing up USD amounts, prices, BPS values, etc.
// At compile time, `USD` and `Price` are incompatible even though
// they're both numbers at runtime.

type Brand<T, B> = T & { readonly __brand: B };

/** USD dollar amount (e.g., 1000.50) */
export type USD = Brand<number, "USD">;

/** Token price in USD (e.g., 3142.50) */
export type Price = Brand<number, "Price">;

/** Basis points (1 BPS = 0.01%, so 50 BPS = 0.5%) */
export type BPS = Brand<number, "BPS">;

/** Percentage as decimal (e.g., 0.05 for 5%) */
export type Percent = Brand<number, "Percent">;

/** Timestamp in milliseconds since epoch */
export type Timestamp = Brand<number, "Timestamp">;

// ─── Brand Constructors (with runtime validation) ──────────

export function usd(value: number): USD {
  if (!Number.isFinite(value)) throw new Error(`Invalid USD: ${value}`);
  return value as USD;
}

export function price(value: number): Price {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`Invalid Price: ${value}`);
  return value as Price;
}

export function bps(value: number): BPS {
  if (!Number.isInteger(value) || value < 0)
    throw new Error(`Invalid BPS: ${value} (must be non-negative integer)`);
  return value as BPS;
}

export function percent(value: number): Percent {
  if (!Number.isFinite(value)) throw new Error(`Invalid Percent: ${value}`);
  return value as Percent;
}

export function timestamp(value: number): Timestamp {
  if (!Number.isFinite(value) || value <= 0)
    throw new Error(`Invalid Timestamp: ${value}`);
  return value as Timestamp;
}

// ─── BPS Helpers ───────────────────────────────────────────

/** Convert BPS to decimal (e.g., 50 BPS → 0.005) */
export function bpsToDecimal(bpsValue: BPS): Percent {
  return percent(bpsValue / 10_000);
}

/** Convert decimal to BPS (e.g., 0.005 → 50 BPS) */
export function decimalToBps(decimal: number): BPS {
  return bps(Math.round(decimal * 10_000));
}

/** Apply BPS rate to a USD amount (e.g., 50 BPS of $1000 = $0.50) */
export function applyBps(amount: USD, bpsValue: BPS): USD {
  return usd((amount * bpsValue) / 10_000);
}

// ─── Type Guards ───────────────────────────────────────────

export function isUSD(value: unknown): value is USD {
  return typeof value === "number" && Number.isFinite(value);
}

export function isPrice(value: unknown): value is Price {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

// ─── Safe Math ─────────────────────────────────────────────

/** Add two USD amounts, returns NaN-safe result */
export function addUSD(a: USD, b: USD): USD {
  const result = a + b;
  if (!Number.isFinite(result))
    throw new Error(`USD addition overflow: ${a} + ${b}`);
  return usd(result);
}

/** Subtract two USD amounts, returns NaN-safe result */
export function subUSD(a: USD, b: USD): USD {
  const result = a - b;
  if (!Number.isFinite(result))
    throw new Error(`USD subtraction error: ${a} - ${b}`);
  return usd(result);
}

/** Multiply USD by a scalar */
export function mulUSD(amount: USD, scalar: number): USD {
  const result = amount * scalar;
  if (!Number.isFinite(result))
    throw new Error(`USD multiplication error: ${amount} * ${scalar}`);
  return usd(result);
}
