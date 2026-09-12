import { describe, expect, it } from 'vitest';
import {
	computeReturn,
	computeBasketMetrics,
	evaluateSnapshot,
	type EvaluatedStock,
	type SnapshotItem
} from '../src/lib/domain/ranking/track-record';

describe('computeReturn', () => {
	it('calculates unadjusted percentage return correctly', () => {
		expect(computeReturn(100, 150)).toBe(50);
		expect(computeReturn(100, 80)).toBe(-20);
	});

	it('adjusts base price when prices diverge by corporate split ratio', () => {
		// 4:1 split: base $400, current $120 (ratio ~3.33) -> adjusted base $100 -> +20%
		expect(computeReturn(400, 120, 4)).toBe(20);
		// 25:1 split: base $2500, current $90 (ratio ~27.7) -> adjusted base $100 -> -10%
		expect(computeReturn(2500, 90, 25)).toBe(-10);
	});

	it('does not adjust when base and current are already on same split scale', () => {
		// Both already on same scale ($100 vs $110)
		expect(computeReturn(100, 110, 4)).toBe(10);
	});

	it('returns 0 when base or current price is non-positive', () => {
		expect(computeReturn(0, 100)).toBe(0);
		expect(computeReturn(100, 0)).toBe(0);
	});
});

describe('computeBasketMetrics', () => {
	it('returns empty metrics when basket has no stocks', () => {
		const metrics = computeBasketMetrics([]);
		expect(metrics.count).toBe(0);
		expect(metrics.meanReturn).toBe(0);
		expect(metrics.medianReturn).toBe(0);
		expect(metrics.winRate).toBe(0);
		expect(metrics.bestPerformer).toBeNull();
	});

	it('computes mean, median, win rate, best/worst accurately', () => {
		const stocks: EvaluatedStock[] = [
			{
				ticker: 'AAA',
				deployment: 'DEPLOY',
				signal: 'PASS',
				basePrice: 10,
				currentPrice: 15,
				returnPct: 50,
				targetPrice: 20,
				targetMet: false
			},
			{
				ticker: 'BBB',
				deployment: 'DEPLOY',
				signal: 'PASS',
				basePrice: 10,
				currentPrice: 11,
				returnPct: 10,
				targetPrice: 12,
				targetMet: false
			},
			{
				ticker: 'CCC',
				deployment: 'DEPLOY',
				signal: 'PASS',
				basePrice: 10,
				currentPrice: 8,
				returnPct: -20,
				targetPrice: 15,
				targetMet: false
			}
		];

		const metrics = computeBasketMetrics(stocks);
		expect(metrics.count).toBe(3);
		// (50 + 10 - 20) / 3 = 13.33
		expect(metrics.meanReturn).toBe(13.33);
		expect(metrics.medianReturn).toBe(10);
		// 2 out of 3 winners
		expect(metrics.winRate).toBe(66.7);
		expect(metrics.bestPerformer).toEqual({ ticker: 'AAA', returnPct: 50 });
		expect(metrics.worstPerformer).toEqual({ ticker: 'CCC', returnPct: -20 });
		expect(metrics.maxDrawdown).toBe(20);
	});
});

describe('evaluateSnapshot', () => {
	it('evaluates snapshot and calculates alpha vs universe', () => {
		const snapshot: SnapshotItem[] = [
			{ ticker: 'DEP1', price: 100, deployment: 'DEPLOY', target: 120 },
			{ ticker: 'DEP2', price: 50, deployment: 'DEPLOY', target: 75 },
			{ ticker: 'WAIT1', price: 200, deployment: 'WAIT' },
			{ ticker: 'FAIL1', price: 80, deployment: 'FAIL' }
		];

		const currentMap = new Map([
			['DEP1', { price: 150, targetPrice: 120 }], // +50%
			['DEP2', { price: 60, targetPrice: 75 }],   // +20%
			['WAIT1', { price: 210, targetPrice: null }], // +5%
			['FAIL1', { price: 64, targetPrice: null }]   // -20%
		]);

		const report = evaluateSnapshot(snapshot, currentMap, '2026-04-05', '2026-09-12');
		expect(report.totalStocks).toBe(4);
		// Deploy basket: (+50 + +20)/2 = +35%
		expect(report.baskets.deploy.meanReturn).toBe(35);
		expect(report.baskets.deploy.winRate).toBe(100);
		// Overall universe: (50 + 20 + 5 - 20)/4 = +13.75%
		expect(report.baskets.overall.meanReturn).toBe(13.75);
		// Alpha: 35 - 13.75 = 21.25%
		expect(report.alphaVsUniverse).toBe(21.25);
	});
});
