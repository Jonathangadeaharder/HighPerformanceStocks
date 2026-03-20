import { describe, expect, it } from 'vitest';

describe('computeQualityBonus', () => {
	const computeQualityBonus = (metrics: Record<string, string | undefined>): number => {
		let bonus = 0;

		const roe = metrics.roe ? Number.parseFloat(metrics.roe.replace('%', '')) : null;
		if (roe != null && roe > 0 && roe < 200) {
			let roeBonus = Math.max(0, Math.min(5, (roe / 25) * 5));
			if (metrics.netDebtEbitda) {
				const debtMultiple = Number.parseFloat(metrics.netDebtEbitda.replace('x', ''));
				if (!Number.isNaN(debtMultiple) && debtMultiple > 3.0) {
					roeBonus *= 0.5;
				}
			}
			bonus += roeBonus;
		}

		const fcfYield = metrics.fcfYield ? Number.parseFloat(metrics.fcfYield.replace('%', '')) : null;
		if (fcfYield != null && fcfYield > 0) {
			const fcfBonus = Math.max(0, Math.min(5, (fcfYield / 5) * 5));
			bonus += fcfBonus;
		}

		return Number(bonus.toFixed(2));
	};

	it('awards points for high ROE', () => {
		expect(computeQualityBonus({ roe: '25%' })).toBe(5);
		expect(computeQualityBonus({ roe: '12.5%' })).toBe(2.5);
	});

	it('caps ROE bonus at 5 points', () => {
		expect(computeQualityBonus({ roe: '50%' })).toBe(5);
	});

	it('rejects unrealistic ROE (>= 200%)', () => {
		expect(computeQualityBonus({ roe: '200%' })).toBe(0);
	});

	it('penalizes high debt', () => {
		expect(computeQualityBonus({ roe: '25%', netDebtEbitda: '4.0x' })).toBe(2.5);
	});

	it('awards points for FCF yield', () => {
		expect(computeQualityBonus({ fcfYield: '5%' })).toBe(5);
		expect(computeQualityBonus({ fcfYield: '2.5%' })).toBe(2.5);
	});

	it('combines ROE and FCF', () => {
		expect(computeQualityBonus({ roe: '25%', fcfYield: '5%' })).toBe(10);
	});

	it('handles missing metrics', () => {
		expect(computeQualityBonus({})).toBe(0);
	});
});

describe('deploymentRank formula', () => {
	interface RankInputs {
		score: number;
		baseCagr: number;
		bearCagr: number;
		upside: number;
		momentumBonus: number;
		qualityBonus: number;
		qcsBonus: number;
	}

	const computeRank = (inputs: RankInputs): number => {
		const { score, baseCagr, bearCagr, upside, momentumBonus, qualityBonus, qcsBonus } = inputs;
		const valuationStrength = Math.max(-25, (1.2 - score) * 25);
		return Number((valuationStrength + baseCagr * 1.2 + bearCagr * 0.8 + upside * 0.1 + momentumBonus + qualityBonus + qcsBonus).toFixed(1));
	};

	it('rewards low screener score (cheap valuation)', () => {
		const cheap = computeRank({ score: 0.5, baseCagr: 20, bearCagr: 5, upside: 30, momentumBonus: 0, qualityBonus: 5, qcsBonus: 8 });
		const expensive = computeRank({ score: 1.5, baseCagr: 20, bearCagr: 5, upside: 30, momentumBonus: 0, qualityBonus: 5, qcsBonus: 8 });
		expect(cheap).toBeGreaterThan(expensive);
	});

	it('values base return more than bear return', () => {
		const highBase = computeRank({ score: 1.0, baseCagr: 30, bearCagr: 5, upside: 30, momentumBonus: 0, qualityBonus: 0, qcsBonus: 0 });
		const highBear = computeRank({ score: 1.0, baseCagr: 5, bearCagr: 30, upside: 30, momentumBonus: 0, qualityBonus: 0, qcsBonus: 0 });
		expect(highBase).toBeGreaterThan(highBear);
	});

	it('caps valuation penalty at -25', () => {
		const extremelyExpensive = computeRank({ score: 3.0, baseCagr: 0, bearCagr: 0, upside: 0, momentumBonus: 0, qualityBonus: 0, qcsBonus: 0 });
		expect(extremelyExpensive).toBe(-25);
	});
});

describe('computeSensitivity', () => {
	const computeSensitivity = (currentPrice: number, targets: { low: number; high: number }): number => {
		const bearReturn = ((targets.low - currentPrice) / currentPrice) * 100;
		const bullReturn = ((targets.high - currentPrice) / currentPrice) * 100;
		return Number((bullReturn - bearReturn).toFixed(1));
	};

	it('measures spread between analyst targets', () => {
		expect(computeSensitivity(100, { low: 80, high: 120 })).toBe(40);
	});

	it('handles wide dispersion', () => {
		expect(computeSensitivity(100, { low: 50, high: 150 })).toBe(100);
	});

	it('handles narrow dispersion', () => {
		expect(computeSensitivity(100, { low: 95, high: 105 })).toBe(10);
	});
});

describe('classifyWorldVol', () => {
	type VolTone = 'buy' | 'hold' | 'sell';
	const classifyWorldVol = (impliedVol: number): VolTone => {
		if (impliedVol < 15) return 'buy';
		if (impliedVol <= 25) return 'hold';
		return 'sell';
	};

	it('signals buy for low volatility', () => {
		expect(classifyWorldVol(10)).toBe('buy');
		expect(classifyWorldVol(14.9)).toBe('buy');
	});

	it('signals hold for moderate volatility', () => {
		expect(classifyWorldVol(15)).toBe('hold');
		expect(classifyWorldVol(20)).toBe('hold');
		expect(classifyWorldVol(25)).toBe('hold');
	});

	it('signals sell for high volatility', () => {
		expect(classifyWorldVol(25.1)).toBe('sell');
		expect(classifyWorldVol(35)).toBe('sell');
	});
});

describe('weightedAverage', () => {
	const weightedAverage = (values: { value: number; weight: number }[]): number | null => {
		if (values.length === 0) return null;
		const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
		if (totalWeight === 0) return null;
		return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
	};

	it('computes weighted average correctly', () => {
		expect(weightedAverage([{ value: 10, weight: 1 }, { value: 20, weight: 1 }])).toBe(15);
	});

	it('applies weights correctly', () => {
		expect(weightedAverage([{ value: 10, weight: 0.7 }, { value: 20, weight: 0.3 }])).toBe(13);
	});

	it('returns null for empty input', () => {
		expect(weightedAverage([])).toBeNull();
	});

	it('returns null for zero total weight', () => {
		expect(weightedAverage([{ value: 10, weight: 0 }])).toBeNull();
	});
});
