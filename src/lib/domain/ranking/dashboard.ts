import type {
	DashboardCounts,
	DashboardData,
	DeploymentStatus,
	FindingStock,
	WorldVolSignal
} from '$lib/types/dashboard';
import { parseDisplayPrice, parsePercent } from '../finance/core';
import { computeMomentumStats, calculateMomentumBonus, type MomentumStats } from './momentum';
import { computeQualityBonus } from './quality';
import {
	assignDeployment,
	hasLikelyValueFloor,
	BEAR_FLOOR_RETURN,
	ETF_HURDLE_RETURN
} from './rules';

/**
 * Calculates the final deployment rank for a stock.
 */
export function calculateDeploymentRank(stock: FindingStock, momentum: MomentumStats): number {
	const base = stock.baseCagr ?? 0;
	const bear = stock.bearCagr ?? 0;
	const upside = Math.min(stock.upside ?? 0, 60);

	const score = stock.screener?.score ?? 1.2;
	const valuationStrength = Math.max(-25, (1.2 - score) * 25);

	let momentumBonus = calculateMomentumBonus(stock, momentum);

	if (momentumBonus < 0 && hasLikelyValueFloor(stock)) {
		momentumBonus = 0;
	}

	const qualityBonus = computeQualityBonus(stock);
	const qcsBonus = stock.qcs?.totalScore ?? 0;

	return +(
		valuationStrength +
		base * 1.2 +
		bear * 0.8 +
		upside * 0.1 +
		momentumBonus +
		qualityBonus +
		qcsBonus
	).toFixed(1);
}

function computeSensitivity(stock: FindingStock): number | null {
	const targets = stock.analystTargets;
	const currentPrice = parseDisplayPrice(stock.currentPrice);
	if (!targets || currentPrice == null || currentPrice <= 0) return null;

	const bearReturn = ((targets.low - currentPrice) / currentPrice) * 100;
	const bullReturn = ((targets.high - currentPrice) / currentPrice) * 100;
	return +(bullReturn - bearReturn).toFixed(1);
}

function selectDiverseTopPicks(
	deployNow: FindingStock[],
	maxPicks: number,
	maxPerGroup: number
): FindingStock[] {
	const picks: FindingStock[] = [];
	const groupCounts: Record<string, number> = {};
	const labels = ['Top Pick', 'Second Pick', 'Third Pick'];
	for (const stock of deployNow) {
		if (picks.length >= maxPicks) break;
		const group = stock.group ?? 'Unknown';
		const count = groupCounts[group] ?? 0;
		if (count >= maxPerGroup) continue;
		groupCounts[group] = count + 1;
		picks.push({ ...stock, pickLabel: labels[picks.length] ?? 'Pick' });
	}
	return picks;
}

function enrichStock(stock: FindingStock, momentum: MomentumStats): FindingStock {
	const enrichedStock = { ...stock };
	const currentPrice = parseDisplayPrice(enrichedStock.currentPrice);
	const targetPrice = parseDisplayPrice(enrichedStock.targetPrice);

	enrichedStock.upside =
		currentPrice !== null && targetPrice !== null
			? Math.round(((targetPrice - currentPrice) / currentPrice) * 100)
			: null;
	enrichedStock.baseCagr = parsePercent(enrichedStock.cagrModel?.scenarios?.base);
	enrichedStock.bearCagr = parsePercent(enrichedStock.cagrModel?.scenarios?.bear);
	enrichedStock.bullCagr = parsePercent(enrichedStock.cagrModel?.scenarios?.bull);
	enrichedStock.sensitivityCagr = computeSensitivity(enrichedStock);

	assignDeployment(enrichedStock);
	enrichedStock.deploymentRank =
		enrichedStock.deployment?.status === 'DEPLOY'
			? calculateDeploymentRank(enrichedStock, momentum)
			: null;

	return enrichedStock;
}

function compareWatchlistStocks(left: FindingStock, right: FindingStock): number {
	const order: Record<DeploymentStatus, number> = {
		REJECT: 0,
		FAIL: 1,
		OVERPRICED: 2,
		NO_DATA: 3,
		'FLAG FOR MANUAL REVIEW': 3,
		DEPLOY: 4,
		WAIT: 5
	};
	const deploymentDiff =
		order[left.deployment?.status ?? 'NO_DATA'] - order[right.deployment?.status ?? 'NO_DATA'];
	if (deploymentDiff !== 0) return deploymentDiff;
	if (left.screener?.engine === right.screener?.engine) {
		const scoreDiff = (left.screener?.score ?? 999) - (right.screener?.score ?? 999);
		if (scoreDiff !== 0) return scoreDiff;
		return (left.ticker ?? '').localeCompare(right.ticker ?? '');
	}

	if (left.screener?.engine === 'fPERG') return -1;
	if (right.screener?.engine === 'fPERG') return 1;

	return (left.screener?.engine ?? '').localeCompare(right.screener?.engine ?? '');
}

function buildCounts(
	stocks: FindingStock[],
	deployNow: FindingStock[],
	cheapWait: FindingStock[],
	watchlist: FindingStock[]
): DashboardCounts {
	return {
		total: stocks.length,
		deploy: deployNow.length,
		wait: cheapWait.length,
		reject: watchlist.filter((stock) => stock.deployment?.status === 'REJECT').length,
		fail: watchlist.filter((stock) => stock.deployment?.status === 'FAIL').length,
		overpriced: watchlist.filter((stock) => stock.deployment?.status === 'OVERPRICED').length,
		noData: watchlist.filter((stock) => stock.deployment?.status === 'NO_DATA').length
	};
}

function latestUpdatedDate(stocks: FindingStock[]): string {
	return stocks
		.reduce((latest, stock) => {
			return (stock.lastUpdated ?? '') > latest ? (stock.lastUpdated ?? latest) : latest;
		}, '')
		.slice(0, 10);
}

export function buildDashboardData(
	stocks: FindingStock[],
	worldVolSignal: WorldVolSignal
): DashboardData {
	const momentum = computeMomentumStats(stocks);
	const enrichedStocks = stocks.map((stock) => enrichStock(stock, momentum));

	const deployNow = enrichedStocks
		.filter((stock) => stock.deployment?.status === 'DEPLOY')
		.toSorted(
			(left, right) => (right.deploymentRank ?? -Infinity) - (left.deploymentRank ?? -Infinity)
		);

	const topPicks = selectDiverseTopPicks(deployNow, 3, 2);

	const cheapWait = enrichedStocks
		.filter((stock) => stock.deployment?.status === 'WAIT')
		.toSorted((left, right) => (left.screener?.score ?? 999) - (right.screener?.score ?? 999));

	const watchlist = enrichedStocks
		.filter((stock) => !['DEPLOY', 'WAIT'].includes(stock.deployment?.status ?? ''))
		.toSorted(compareWatchlistStocks);

	return {
		worldVolSignal,
		topPicks,
		deployNow,
		cheapWait,
		watchlist,
		lastUpdated: latestUpdatedDate(enrichedStocks),
		hurdles: {
			etfCagr: ETF_HURDLE_RETURN,
			bearFloor: BEAR_FLOOR_RETURN
		},
		counts: buildCounts(enrichedStocks, deployNow, cheapWait, watchlist)
	};
}
