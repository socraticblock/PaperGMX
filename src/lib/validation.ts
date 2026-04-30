import type { USD, Price } from "@/lib/branded";
import { usd } from "@/lib/branded";

// ─── Input Validation ─────────────────────────────────────

/**
 * Validate a balance amount for initialization or top-up.
 * @returns The validated amount or throws
 */
export function validateBalanceAmount(amount: number, context: string = "amount"): USD {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`Invalid ${context}: not a finite number (${amount})`);
  }
  if (amount <= 0) {
    throw new Error(`Invalid ${context}: must be positive (${amount})`);
  }
  if (amount > 10_000_000) {
    throw new Error(`Invalid ${context}: exceeds maximum ($10,000,000)`);
  }
  return usd(amount);
}

/**
 * Validate a trade amount.
 * @returns The validated amount or throws
 */
export function validateTradeAmount(amount: number, balance: USD): USD {
  if (typeof amount !== "number" || !Number.isFinite(amount)) {
    throw new Error(`Invalid trade amount: not a finite number (${amount})`);
  }
  if (amount < 1) {
    throw new Error(`Invalid trade amount: minimum is $1 (${amount})`);
  }
  if (amount > balance) {
    throw new Error(`Invalid trade amount: exceeds balance (${amount} > ${balance})`);
  }
  return usd(amount);
}

/**
 * Validate leverage value.
 */
export function validateLeverage(leverage: number, maxLeverage: number): number {
  if (typeof leverage !== "number" || !Number.isFinite(leverage)) {
    throw new Error(`Invalid leverage: not a finite number (${leverage})`);
  }
  if (leverage < 1) {
    throw new Error(`Invalid leverage: minimum is 1x (${leverage})`);
  }
  if (leverage > maxLeverage) {
    throw new Error(`Invalid leverage: exceeds maximum (${leverage} > ${maxLeverage}x)`);
  }
  return leverage;
}

/**
 * Validate a price value.
 */
export function validatePrice(value: number, context: string = "price"): Price {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid ${context}: not a finite number (${value})`);
  }
  if (value <= 0) {
    throw new Error(`Invalid ${context}: must be positive (${value})`);
  }
  return value as Price;
}

/**
 * Sanitize a number input from user (e.g., form field).
 * Returns NaN if invalid, which should be handled by the UI.
 */
export function sanitizeNumericInput(input: string): number {
  if (!input || input.trim() === "") return NaN;
  const parsed = parseFloat(input);
  return Number.isFinite(parsed) ? parsed : NaN;
}
