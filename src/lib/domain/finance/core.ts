/**
 * finance/core.ts — Core financial calculations
 *
 * Uses 1-year forward expected returns based on analyst price targets.
 * Simple and transparent: (targetPrice - currentPrice) / currentPrice.
 */

/**
 * Extracts a numeric percentage from a string (e.g., "15.5%" -> 15.5)
 */
export function parsePercent(value: string | number | null | undefined): number | null {
	if (value == null) return null;

	const re = /-?\d+(?:\.\d+)?/;
	const match = re.exec(String(value));
	return match ? Number.parseFloat(match[0]) : null;
}

/**
 * Extracts a numeric price from a string (e.g., "$1,200.50" -> 1200.5)
 */
export function parseDisplayPrice(value: string | number | null | undefined): number | null {
	if (value == null) return null;
	if (typeof value === 'number') return value;
	if (typeof value !== 'string') return null;

	const cleaned = value.replaceAll(/[^0-9.]/g, '');
	const dotsMatch = cleaned.match(/\./g);
	if (!cleaned || (dotsMatch && dotsMatch.length > 1)) return null;

	const parsedNumber = Number.parseFloat(cleaned);
	if (Number.isNaN(parsedNumber)) return null;

	// Handle pence (p) if detected at end of string without space needed
	if (/\d\s*p$/i.test(value.trim())) return parsedNumber / 100;

	return parsedNumber;
}

interface ForwardReturnParams {
	currentPrice: number;
	targetPrice: number;
	dividendYieldPct?: number;
}

/**
 * Calculate 1-year forward expected return.
 */
export function calcForwardReturn({
	currentPrice,
	targetPrice,
	dividendYieldPct = 0
}: ForwardReturnParams): number {
	if (currentPrice <= 0) {
		throw new Error('calcForwardReturn: currentPrice must be positive');
	}
	if (targetPrice <= 0) {
		throw new Error('calcForwardReturn: targetPrice must be positive');
	}

	return ((targetPrice - currentPrice) / currentPrice) * 100 + dividendYieldPct;
}

interface ForwardScenariosParams {
	currentPrice: number;
	targetLow: number;
	targetMean: number;
	targetHigh: number;
	dividendYieldPct?: number;
}

export interface ForwardScenarios {
	bear: number;
	base: number;
	bull: number;
}

/**
 * Calculate scenario-based 1-year forward returns using analyst low/mean/high targets.
 */
export function calcForwardScenarios({
	currentPrice,
	targetLow,
	targetMean,
	targetHigh,
	dividendYieldPct = 0
}: ForwardScenariosParams): ForwardScenarios {
	if (currentPrice <= 0) {
		throw new Error('calcForwardScenarios: currentPrice must be positive');
	}

	return {
		bear: calcForwardReturn({ currentPrice, targetPrice: targetLow, dividendYieldPct }),
		base: calcForwardReturn({ currentPrice, targetPrice: targetMean, dividendYieldPct }),
		bull: calcForwardReturn({ currentPrice, targetPrice: targetHigh, dividendYieldPct })
	};
}
