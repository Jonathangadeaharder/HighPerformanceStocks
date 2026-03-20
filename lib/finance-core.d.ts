/**
 * Core financial calculations for 1-year forward expected returns.
 */

/**
 * Parses a percentage value from various formats (e.g., "15.5%", 15.5, "15.5").
 * Returns null for null/undefined, but correctly handles 0.
 */
export function parsePercent(value: string | number | null | undefined): number | null;

/**
 * Parses a display price from various formats (e.g., "$150.50", "150.50p").
 * Returns null for null/undefined or malformed input (e.g., multiple decimals).
 */
export function parseDisplayPrice(value: string | number | null | undefined): number | null;

/**
 * Calculate 1-year forward expected return.
 * Simple and transparent: (targetPrice - currentPrice) / currentPrice + dividendYield
 */
export function calcForwardReturn(input: {
	/** Current stock price (must be positive) */
	currentPrice: number;
	/** Analyst target price (must be positive) */
	targetPrice: number;
	/** Dividend yield as percentage (default: 0) */
	dividendYieldPct?: number;
}): number;

/**
 * Calculate scenario-based 1-year forward returns.
 * Uses analyst low/mean/high targets for bear/base/bull scenarios.
 */
export function calcForwardScenarios(input: {
	/** Current stock price (must be positive) */
	currentPrice: number;
	/** Analyst low target price */
	targetLow: number;
	/** Analyst mean target price */
	targetMean: number;
	/** Analyst high target price */
	targetHigh: number;
	/** Dividend yield as percentage (default: 0) */
	dividendYieldPct?: number;
}): {
	bear: number;
	base: number;
	bull: number;
};
