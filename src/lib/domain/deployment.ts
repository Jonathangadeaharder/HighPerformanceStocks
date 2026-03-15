import { parseDisplayPrice, parsePercent } from '../../../lib/finance-core.js';
import type {
	DashboardCounts,
	DashboardData,
	DeploymentInfo,
	DeploymentStatus,
	FindingStock,
	WorldVolSignal
} from '$lib/types/dashboard';

const ETF_HURDLE_CAGR = 14;
const BEAR_FLOOR_CAGR = 0;
const VALUE_FLOOR_BEAR_CAGR = 12;
const VALUE_FLOOR_BASE_CAGR = 18;
const VALUE_FLOOR_UPSIDE = 25;
const VALUE_FLOOR_MAX_SCORE = 0.65;

function deploymentRank(stock: FindingStock): number {
	const base = stock.baseCagr ?? 0;
	const bear = stock.bearCagr ?? 0;
	const upside = Math.min(stock.upside ?? 0, 60);

	const valuationStrength =
		stock.screener?.engine === 'totalReturn'
			? Math.max(0, (stock.screener.score ?? 0) - 10) * 2.5
			: Math.max(0, 1.2 - (stock.screener?.score ?? 99)) * 25;

	return +(valuationStrength + base * 1.2 + bear * 0.8 + upside * 0.1).toFixed(1);
}

function hasLikelyValueFloor(stock: FindingStock): boolean {
	const stabilization = stock.screener?.realityChecks?.stabilization;
	const revisions = stock.screener?.realityChecks?.revisions;

	if (!stabilization?.near3mLow) return false;
	if (!revisions?.pass) return false;
	if ((revisions.up30d ?? 0) <= (revisions.down30d ?? 0)) return false;
	if ((stock.screener?.score ?? 99) > VALUE_FLOOR_MAX_SCORE) return false;
	if ((stock.upside ?? 0) < VALUE_FLOOR_UPSIDE) return false;

	return (
		(stock.bearCagr ?? -999) >= VALUE_FLOOR_BEAR_CAGR &&
		(stock.baseCagr ?? -999) >= VALUE_FLOOR_BASE_CAGR
	);
}

function deploymentForPass(stock: FindingStock): DeploymentInfo {
	const clearsHurdle =
		(stock.baseCagr ?? -999) >= ETF_HURDLE_CAGR && (stock.bearCagr ?? -999) > BEAR_FLOOR_CAGR;

	return clearsHurdle
		? { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' }
		: {
				status: 'FAIL',
				reason: `Does not clear the ${ETF_HURDLE_CAGR}% ETF hurdle with a positive bear case.`
			};
}

function deploymentForWait(stock: FindingStock): DeploymentInfo {
	return hasLikelyValueFloor(stock)
		? {
				status: 'DEPLOY',
				reason:
					'Likely value floor: strong bear/base returns, deep upside, supportive revisions, and price already near the 3-month low.'
			}
		: { status: 'WAIT', reason: stock.screener?.note ?? 'Cheap, but still stabilizing.' };
}

function deploymentForFail(stock: FindingStock): DeploymentInfo {
	const epsGrowth = parsePercent(stock.cagrModel?.epsGrowth) ?? 0;
	if (epsGrowth >= 20 && (stock.screener?.score ?? 0) >= 1.5) {
		return {
			status: 'OVERPRICED',
			reason: stock.screener?.note ?? 'High-growth business at an extreme valuation. Wait for significant multiple compression.'
		};
	}
	return { status: 'FAIL', reason: stock.screener?.note ?? 'No valuation edge.' };
}

function assignDeployment(stock: FindingStock): void {
	const signal = stock.screener?.signal ?? 'NO_DATA';

	switch (signal) {
		case 'PASS': {
			stock.deployment = deploymentForPass(stock);
			return;
		}
		case 'WAIT': {
			stock.deployment = deploymentForWait(stock);
			return;
		}
		case 'REJECTED': {
			stock.deployment = {
				status: 'REJECT',
				reason: stock.screener?.note ?? 'Consensus is deteriorating.'
			};
			return;
		}
		case 'FAIL': {
			stock.deployment = deploymentForFail(stock);
			return;
		}
		case 'NO_DATA': {
			stock.deployment = {
				status: 'NO_DATA',
				reason: stock.screener?.note ?? 'Insufficient data.'
			};
			return;
		}
	}
}

function enrichStock(stock: FindingStock): FindingStock {
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

	assignDeployment(enrichedStock);
	enrichedStock.deploymentRank =
		enrichedStock.deployment?.status === 'DEPLOY' ? deploymentRank(enrichedStock) : null;

	return enrichedStock;
}

function compareWatchlistStocks(left: FindingStock, right: FindingStock): number {
	const order: Record<DeploymentStatus, number> = {
		REJECT: 0,
		FAIL: 1,
		OVERPRICED: 2,
		NO_DATA: 3,
		DEPLOY: 4,
		WAIT: 5
	};
	const deploymentDiff =
		order[left.deployment?.status ?? 'NO_DATA'] - order[right.deployment?.status ?? 'NO_DATA'];
	if (deploymentDiff !== 0) return deploymentDiff;
	if (left.screener?.engine === right.screener?.engine) {
		return (left.screener?.score ?? 999) - (right.screener?.score ?? 999);
	}

	return left.screener?.engine === 'fPERG' ? -1 : 1;
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
	const enrichedStocks = stocks.map((stock) => enrichStock(stock));

	const deployNow = enrichedStocks
		.filter((stock) => stock.deployment?.status === 'DEPLOY')
		.toSorted(
			(left, right) => (right.deploymentRank ?? -Infinity) - (left.deploymentRank ?? -Infinity)
		);

	const topPicks = deployNow.slice(0, 3).map((stock, index) => ({
		...stock,
		pickLabel: ['Top Pick', 'Second Pick', 'Third Pick'][index] ?? 'Pick'
	}));

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
			etfCagr: ETF_HURDLE_CAGR,
			bearFloor: BEAR_FLOOR_CAGR
		},
		counts: buildCounts(enrichedStocks, deployNow, cheapWait, watchlist)
	};
}
