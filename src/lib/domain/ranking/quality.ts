import type { FindingStock } from '$lib/types/dashboard';
import { parsePercent } from '../finance/core';

/**
 * Computes a quality bonus based on ROE and FCF Yield.
 */
export function computeQualityBonus(stock: FindingStock): number {
	const m = stock.metrics;
	if (!m) return 0;
	let bonus = 0;

	// Part B: Return on Equity (Max 5 Points)
	let roeBonus = 0;
	const roe = parsePercent(m.roe);
	if (roe != null && roe > 0 && roe < 200) {
		roeBonus = Math.max(0, Math.min(5, (roe / 25) * 5));
	}

	// De-lever the ROE. High ROE driven by extreme debt is not "Quality".
	const netDebt = m.netDebtEbitda;
	if (netDebt != null) {
		const debtStr = typeof netDebt === 'string' ? netDebt : String(netDebt);
		const debtMultiple = Number.parseFloat(debtStr.replace(/[^\d.-]/g, ''));
		if (!Number.isNaN(debtMultiple) && debtMultiple > 3.0) {
			roeBonus *= 0.5;
		}
	}
	bonus += roeBonus;

	// Part A: FCF Yield (Max 5 Points)
	const fcfYield = parsePercent(m.fcfYield);
	if (fcfYield != null && fcfYield > 0) {
		const fcfBonus = Math.max(0, Math.min(5, (fcfYield / 5) * 5));
		bonus += fcfBonus;
	}

	return +bonus.toFixed(2);
}
