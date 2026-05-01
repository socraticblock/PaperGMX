// ─── Number Formatting Utilities ──────────────────────────

/**
 * Format a number as USD price with appropriate decimals
 * BTC/ETH: 2 decimals, SOL/ARB: 4 decimals
 */
export function formatPrice(price: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(price);
}

/**
 * Format a number as USD with commas and 2 decimal places
 */
export function formatUSD(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format a number as compact USD (e.g., $1.2M, $500K)
 * Handles negative amounts correctly: -$5.0K instead of $-5.0K
 */
export function formatUSDCompact(amount: number): string {
  if (amount < 0) return "-" + formatUSDCompact(Math.abs(amount));
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return formatUSD(amount);
}

/**
 * Format a percentage value
 */
export function formatPercent(value: number, decimals: number = 2): string {
  if (Math.abs(value) < 0.005) return `${(0).toFixed(decimals)}%`; // Show "0.00%" instead of "+0.00%"
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Format a large number with commas
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format duration in hours and minutes
 */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format a USDC balance for display
 */
export function formatBalance(balance: number): string {
  return `${formatUSD(balance)} USDC`;
}

/**
 * Truncate an Ethereum address for display
 */
export function truncateAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
