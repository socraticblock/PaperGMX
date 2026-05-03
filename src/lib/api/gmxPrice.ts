/**
 * GMX V2 Price Conversion Utilities
 *
 * GMX's API returns all prices and amounts as 30-decimal USD strings.
 * For example, ETH at $2,263.21 is represented as:
 *   "2263212401601249" (which is 2263.21 * 10^30 / 10^18 = 2263.21 * 10^12)
 *
 * The conversion formula is:
 *   actualUSD = BigInt(rawString) / 10^(30 - tokenDecimals)
 *
 * ETH has 18 decimals, so we divide by 10^12.
 * BTC has 8 decimals, so we divide by 10^22.
 * USDC has 6 decimals, so we divide by 10^24.
 *
 * We use BigInt arithmetic to avoid floating-point precision loss,
 * then convert to number for display. This is safe because our
 * prices are at most ~$100K, well within JS number precision.
 */

import type { USD, Price, Percent } from "@/types";
import { usd, price, percent } from "@/lib/branded";

// GMX uses 30-decimal precision for all USD amounts
const GMX_USD_DECIMALS = 30;

/**
 * Convert a GMX 30-decimal string to a USD number.
 *
 * @param rawValue - The raw string from the API (e.g., "2263212401601249")
 * @param tokenDecimals - The token's decimal count (e.g., 18 for ETH)
 * @returns USD branded number
 *
 * @example
 * // ETH (18 decimals) at ~$2,263
 * parseGmxPrice("2263212401601249", 18) // → USD ~2263.21
 *
 * // BTC (8 decimals) at ~$76,285
 * parseGmxPrice("762852859759876100000000000", 8) // → USD ~76285.29
 */
export function parseGmxUsdValue(rawValue: string, tokenDecimals: number): USD {
  if (!rawValue || rawValue.trim() === "") return usd(0);

  try {
    const bigValue = BigInt(rawValue);
    const divisor = BigInt(10) ** BigInt(GMX_USD_DECIMALS - tokenDecimals);

    // Integer division first
    const wholePart = bigValue / divisor;

    // Calculate remainder for fractional part (up to 8 decimal places for precision)
    const remainder = bigValue % divisor;
    const fractionalDivisor = divisor / BigInt(10 ** 8);
    const fractionalPart =
      fractionalDivisor > BigInt(0)
        ? Number(remainder / fractionalDivisor) / 10 ** 8
        : 0;

    const result = Number(wholePart) + fractionalPart;

    if (!Number.isFinite(result)) {
      console.warn(
        `[GmxPrice] Non-finite result for ${rawValue} / 10^${GMX_USD_DECIMALS - tokenDecimals}`,
      );
      return usd(0);
    }

    return usd(result);
  } catch (e) {
    console.warn(`[GmxPrice] Failed to parse "${rawValue}":`, e);
    return usd(0);
  }
}

/**
 * Parse a GMX price string (minPrice or maxPrice) to a Price branded type.
 * Returns 0 for invalid/zero prices instead of a positive sentinel.
 * Downstream consumers check `priceData.last <= 0` to reject stale/missing
 * data — a sentinel of 0.01 would pass that check, allowing garbage data
 * to be treated as valid.
 *
 * Note: price(0) would throw (Price must be > 0), so we use a type cast
 * for the zero case. The zero value is always checked before use as a Price.
 */
export function parseGmxPrice(rawValue: string, tokenDecimals: number): Price {
  const value = parseGmxUsdValue(rawValue, tokenDecimals);
  // Return 0 for zero/negative prices — downstream checks will reject them
  // Use type cast since Price brand requires > 0, but 0 is a valid "no data" signal
  return value > 0 ? price(value) : (0 as Price);
}

/**
 * Convert a GMX per-second rate to an annualized percentage.
 *
 * GMX rates are stored as 30-decimal values representing per-second rates.
 * To annualize: ratePerSecond * secondsPerYear * 100
 *
 * But first we need to convert from 30-decimal format.
 *
 * @param rawRate - The raw rate string from the API
 * @param tokenDecimals - Token decimals (usually 30 for rate calculations)
 * @returns Annualized percentage as Percent branded type
 *
 * @example
 * // Borrowing rate of "50652112006367956795278240000" for BTC
 * // This represents a per-second rate that annualizes to ~some %
 */
export function parseGmxAnnualRate(
  rawRate: string,
  tokenDecimals: number = 30,
): Percent {
  if (!rawRate || rawRate === "0") return percent(0);

  try {
    const bigRate = BigInt(rawRate);
    const divisor = BigInt(10) ** BigInt(tokenDecimals);
    const SECONDS_PER_YEAR = BigInt(31_536_000);

    // ratePerSecond (as decimal) * secondsPerYear * 100 = annualized %
    // We multiply by 100 * 10^8 for precision, then divide by 10^8
    const precisionMultiplier = BigInt(10 ** 8);
    const annualized =
      (bigRate * SECONDS_PER_YEAR * BigInt(100) * precisionMultiplier) /
      divisor;
    const result = Number(annualized) / 10 ** 8;

    if (!Number.isFinite(result)) {
      console.warn(`[GmxRate] Non-finite rate for "${rawRate}"`);
      return percent(0);
    }

    return percent(result);
  } catch (e) {
    console.warn(`[GmxRate] Failed to parse rate "${rawRate}":`, e);
    return percent(0);
  }
}

/**
 * Parse a GMX per-second rate to the per-second decimal value
 * used in our calculation functions.
 *
 * @param rawRate - The raw rate string from the API
 * @param tokenDecimals - Token decimals for the rate (usually 30)
 * @returns Per-second rate as a plain number
 */
export function parseGmxPerSecondRate(
  rawRate: string,
  tokenDecimals: number = 30,
): number {
  if (!rawRate || rawRate === "0") return 0;

  try {
    const bigRate = BigInt(rawRate);
    const divisor = BigInt(10) ** BigInt(tokenDecimals);

    // Use high precision: multiply by 10^15 first, then divide
    const precision = BigInt(10 ** 15);
    const result = Number((bigRate * precision) / divisor) / 10 ** 15;

    if (!Number.isFinite(result)) {
      return 0;
    }

    return result;
  } catch {
    return 0;
  }
}

/** Seconds per Gregorian year (GMX-style annualization). */
export const SECONDS_PER_YEAR = 31_536_000;

/**
 * After dividing a GMX 1e30 rate string by 10^30, values above this are treated as
 * **annual APR decimals** (e.g. 0.12 = 12%/year). Smaller magnitudes are treated as
 * **per-second** factors (unit tests / legacy shapes). This matches live
 * `arbitrum-api.gmxinfra.io` /markets/info behaviour for borrowing/funding fields.
 */
export const GMX_RATE_ANNUAL_DECIMAL_THRESHOLD = 1e-5;

const MAX_IMPLIED_APR_PERCENT = 500;

function clampBorrowFundingRates(perSecond: number, annualizedPercent: number) {
  const impliedApr = Math.abs(perSecond * SECONDS_PER_YEAR * 100);
  if (impliedApr <= MAX_IMPLIED_APR_PERCENT || impliedApr === 0) {
    return { perSecond, annualizedPercent };
  }
  const scale = MAX_IMPLIED_APR_PERCENT / impliedApr;
  return {
    perSecond: perSecond * scale,
    annualizedPercent: annualizedPercent * scale,
  };
}

/**
 * Parse GMX borrowing/funding rate strings from `/markets/info` into per-second
 * (for accrual) and annualized % (for display).
 */
export function parseGmxBorrowFundingRate(
  rawRate: string,
  tokenDecimals: number = 30,
): { perSecond: number; annualizedPercent: number } {
  if (!rawRate || rawRate === "0") {
    return { perSecond: 0, annualizedPercent: 0 };
  }

  try {
    const bigRate = BigInt(rawRate);
    const divisor = BigInt(10) ** BigInt(tokenDecimals);
    const precision = BigInt(10 ** 15);
    const R = Number((bigRate * precision) / divisor) / 10 ** 15;

    if (!Number.isFinite(R)) {
      return { perSecond: 0, annualizedPercent: 0 };
    }

    const absR = Math.abs(R);
    if (absR > GMX_RATE_ANNUAL_DECIMAL_THRESHOLD) {
      const perSecond = R / SECONDS_PER_YEAR;
      const annualizedPercent = R * 100;
      return clampBorrowFundingRates(perSecond, annualizedPercent);
    }

    const perSecond = R;
    const annualizedPercent = R * SECONDS_PER_YEAR * 100;
    return clampBorrowFundingRates(perSecond, annualizedPercent);
  } catch {
    return { perSecond: 0, annualizedPercent: 0 };
  }
}

/**
 * Calculate 24h price change percentage.
 * Since the GMX API doesn't directly provide 24h change,
 * we track previous prices and compute it ourselves.
 */
export function calculatePriceChangePercent(
  currentPrice: Price,
  previousPrice: Price,
): Percent {
  if (previousPrice <= 0) return percent(0);
  const change = ((currentPrice - previousPrice) / previousPrice) * 100;
  return percent(Number.isFinite(change) ? change : 0);
}

/**
 * Get the oracle price spread (max - min) as a percentage.
 * A wide spread indicates low liquidity or high volatility.
 */
export function calculateSpreadPercent(
  minPrice: Price,
  maxPrice: Price,
): Percent {
  if (minPrice <= 0) return percent(0);
  const midPrice = (minPrice + maxPrice) / 2;
  if (midPrice <= 0) return percent(0);
  const spread = ((maxPrice - minPrice) / midPrice) * 100;
  return percent(Number.isFinite(spread) ? spread : 0);
}
