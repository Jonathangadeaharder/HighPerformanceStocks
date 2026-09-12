import { parseDisplayPrice } from '../finance/core.js';

export interface SnapshotItem {
	ticker: string;
	price: number | string;
	signal?: string;
	deployment?: string;
	score?: number | null;
	target?: number | string | null;
}

export interface EvaluatedStock {
	ticker: string;
	deployment: string;
	signal: string;
	basePrice: number;
	currentPrice: number;
	returnPct: number;
	targetPrice: number | null;
	targetMet: boolean;
}

export interface BasketMetrics {
	count: number;
	meanReturn: number;
	medianReturn: number;
	winRate: number;
	bestPerformer: { ticker: string; returnPct: number } | null;
	worstPerformer: { ticker: string; returnPct: number } | null;
	maxDrawdown: number;
}

export interface TrackRecordReport {
	baselineDate: string;
	currentDate: string;
	totalStocks: number;
	baskets: {
		deploy: BasketMetrics;
		trim: BasketMetrics;
		wait: BasketMetrics;
		fail: BasketMetrics;
		overall: BasketMetrics;
	};
	alphaVsUniverse: number;
	stocks: EvaluatedStock[];
}

export function parseNumericPrice(val: number | string | null | undefined): number | null {
	if (val == null) return null;
	if (typeof val === 'number') return Number.isFinite(val) ? val : null;
	return parseDisplayPrice(String(val));
}

// Computes percentage return, auto-detecting if split adjustment applies.
export function computeReturn(base: number, current: number, knownSplit = 1): number {
	if (base <= 0 || current <= 0) return 0;
	let adjBase = base;
	if (knownSplit > 1) {
		const ratio = base / current;
		if (Math.abs(ratio - knownSplit) / knownSplit < 0.35) {
			adjBase = base / knownSplit;
		} else if (Math.abs(current / base - knownSplit) / knownSplit < 0.35) {
			adjBase = base * knownSplit;
		}
	}
	return +((current / adjBase - 1) * 100).toFixed(2);
}

export function computeBasketMetrics(stocks: EvaluatedStock[]): BasketMetrics {
	if (stocks.length === 0) {
		return {
			count: 0,
			meanReturn: 0,
			medianReturn: 0,
			winRate: 0,
			bestPerformer: null,
			worstPerformer: null,
			maxDrawdown: 0
		};
	}

	const returns = stocks.map((s) => s.returnPct).sort((a, b) => a - b);
	const sum = returns.reduce((acc, r) => acc + r, 0);
	const meanReturn = +(sum / returns.length).toFixed(2);

	const mid = Math.floor(returns.length / 2);
	const medianReturn =
		returns.length % 2 === 0
			? +((returns[mid - 1]! + returns[mid]!) / 2).toFixed(2)
			: +returns[mid]!.toFixed(2);

	const winners = returns.filter((r) => r > 0).length;
	const winRate = +((winners / returns.length) * 100).toFixed(1);

	const sortedStocks = [...stocks].sort((a, b) => b.returnPct - a.returnPct);
	const best = sortedStocks[0]!;
	const worst = sortedStocks.at(-1)!;

	const worstReturn = returns[0]!;
	const maxDrawdown = worstReturn < 0 ? Math.abs(worstReturn) : 0;

	return {
		count: stocks.length,
		meanReturn,
		medianReturn,
		winRate,
		bestPerformer: { ticker: best.ticker, returnPct: best.returnPct },
		worstPerformer: { ticker: worst.ticker, returnPct: worst.returnPct },
		maxDrawdown
	};
}

export function evaluateSnapshot(
	baselineItems: SnapshotItem[],
	currentMap: Map<string, { price: number; targetPrice?: number | null }>,
	baselineDate: string,
	currentDate: string,
	splitMultipliers: Record<string, number> = {}
): TrackRecordReport {
	const evaluated: EvaluatedStock[] = [];

	for (const item of baselineItems) {
		const basePrice = parseNumericPrice(item.price);
		const current = currentMap.get(item.ticker);
		if (basePrice == null || !current || current.price <= 0) continue;

		const split = splitMultipliers[item.ticker] ?? 1;
		const returnPct = computeReturn(basePrice, current.price, split);
		const targetPrice = current.targetPrice ?? parseNumericPrice(item.target);
		const targetMet = targetPrice != null && targetPrice > 0 && current.price >= targetPrice;

		const deployment = (item.deployment || (item.signal === 'PASS' ? 'DEPLOY' : item.signal || 'WAIT')).toUpperCase();

		evaluated.push({
			ticker: item.ticker,
			deployment,
			signal: item.signal || deployment,
			basePrice,
			currentPrice: current.price,
			returnPct,
			targetPrice,
			targetMet
		});
	}

	const deployStocks = evaluated.filter((s) => s.deployment === 'DEPLOY');
	const trimStocks = evaluated.filter((s) => s.deployment === 'TRIM');
	const waitStocks = evaluated.filter((s) => s.deployment === 'WAIT');
	const failStocks = evaluated.filter((s) => s.deployment === 'FAIL' || s.deployment === 'REJECT');

	const deploy = computeBasketMetrics(deployStocks);
	const trim = computeBasketMetrics(trimStocks);
	const wait = computeBasketMetrics(waitStocks);
	const fail = computeBasketMetrics(failStocks);
	const overall = computeBasketMetrics(evaluated);

	const alphaVsUniverse = +(deploy.meanReturn - overall.meanReturn).toFixed(2);

	return {
		baselineDate,
		currentDate,
		totalStocks: evaluated.length,
		baskets: {
			deploy,
			trim,
			wait,
			fail,
			overall
		},
		alphaVsUniverse,
		stocks: evaluated
	};
}
