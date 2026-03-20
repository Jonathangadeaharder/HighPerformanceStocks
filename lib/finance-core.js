/**
 * finance-core.js — Core financial calculations
 *
 * Uses 1-year forward expected returns based on analyst price targets.
 * No arbitrary assumptions about growth decay, terminal rates, or exit multiples.
 */

export function parsePercent(value) {
	if (value == null) return null;

	const match = String(value).match(/-?\d+(?:\.\d+)?/);
	return match ? Number.parseFloat(match[0]) : null;
}

export function parseDisplayPrice(value) {
	if (value == null) return null;

	const cleaned = String(value).replace(/[^0-9.]/g, '');
	if ((cleaned.match(/\./g) || []).length > 1) return null;
	const parsedNumber = Number.parseFloat(cleaned);
	if (Number.isNaN(parsedNumber)) return null;
	if (/\d\s*p$/i.test(String(value))) return parsedNumber / 100;
	return parsedNumber;
}

/**
 * Calculate 1-year forward expected return.
 * Simple and transparent: (targetPrice - currentPrice) / currentPrice + dividendYield
 *
 * @param {object} params
 * @param {number} params.currentPrice - Current stock price
 * @param {number} params.targetPrice - Analyst consensus target price (mean)
 * @param {number} [params.dividendYieldPct=0] - Dividend yield as percentage
 * @returns {number} Expected 1-year return as percentage
 */
export function calcForwardReturn({ currentPrice, targetPrice, dividendYieldPct = 0 }) {
	if (currentPrice <= 0) {
		throw new Error('calcForwardReturn: currentPrice must be positive');
	}
	if (targetPrice <= 0) {
		throw new Error('calcForwardReturn: targetPrice must be positive');
	}

	const priceReturn = ((targetPrice - currentPrice) / currentPrice) * 100;
	return priceReturn + dividendYieldPct;
}

/**
 * Calculate scenario-based 1-year forward returns.
 * Uses analyst low/mean/high targets for bear/base/bull scenarios.
 *
 * @param {object} params
 * @param {number} params.currentPrice - Current stock price
 * @param {number} params.targetLow - Analyst low target price
 * @param {number} params.targetMean - Analyst mean target price
 * @param {number} params.targetHigh - Analyst high target price
 * @param {number} [params.dividendYieldPct=0] - Dividend yield as percentage
 * @returns {{ bear: number, base: number, bull: number }} Scenario returns as percentages
 */
export function calcForwardScenarios({
	currentPrice,
	targetLow,
	targetMean,
	targetHigh,
	dividendYieldPct = 0
}) {
	if (currentPrice <= 0) {
		throw new Error('calcForwardScenarios: currentPrice must be positive');
	}

	return {
		bear: calcForwardReturn({ currentPrice, targetPrice: targetLow, dividendYieldPct }),
		base: calcForwardReturn({ currentPrice, targetPrice: targetMean, dividendYieldPct }),
		bull: calcForwardReturn({ currentPrice, targetPrice: targetHigh, dividendYieldPct })
	};
}
