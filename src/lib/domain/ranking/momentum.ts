import type { FindingStock } from '$lib/types/dashboard';

const MOMENTUM_MIN_UNIVERSE = 5;
const MOMENTUM_MIN_STDDEV = 5;
const MOMENTUM_FALLBACK_MEAN = 0;
const MOMENTUM_FALLBACK_STDDEV = 20;

export interface MomentumStats {
	mean: number;
	stddev: number;
}

/**
 * Computes momentum statistics (mean and standard deviation) for a set of stocks.
 * Uses 6-month minus 1-month returns to skip short-term reversal (Jegadeesh & Titman).
 */
export function computeMomentumStats(stocks: FindingStock[]): MomentumStats {
	const values: number[] = [];
	for (const stock of stocks) {
		const stab = stock.screener?.realityChecks?.stabilization;
		if (stab?.return6m != null && stab.return1m != null) {
			values.push(stab.return6m - stab.return1m);
		}
	}
	if (values.length < MOMENTUM_MIN_UNIVERSE || values.length <= 1) {
		return { mean: MOMENTUM_FALLBACK_MEAN, stddev: MOMENTUM_FALLBACK_STDDEV };
	}
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
	return {
		mean: +mean.toFixed(2),
		stddev: +Math.max(MOMENTUM_MIN_STDDEV, Math.sqrt(variance)).toFixed(2)
	};
}

/**
 * Calculates the momentum bonus/penalty based on Z-score within the universe.
 */
export function calculateMomentumBonus(
	stock: FindingStock,
	momentum: MomentumStats,
	scale = 7.5,
	cap = 15
): number {
	const return6m = stock.screener?.realityChecks?.stabilization?.return6m ?? 0;
	const return1m = stock.screener?.realityChecks?.stabilization?.return1m ?? 0;
	const momentumInput = return6m - return1m;
	const momentumZScore =
		momentum.stddev > 0 ? (momentumInput - momentum.mean) / momentum.stddev : 0;

	return Math.max(-cap, Math.min(cap, momentumZScore * scale));
}
