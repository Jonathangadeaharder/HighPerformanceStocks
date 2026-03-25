import { parseDisplayPrice, parsePercent } from '../../../lib/finance-core.js';
import type {
	DashboardCounts,
	DashboardData,
	DeploymentInfo,
	DeploymentStatus,
	FindingStock,
	WorldVolSignal
} from '$lib/types/dashboard';

const ETF_HURDLE_RETURN = 15;
const VALUE_FLOOR_BEAR_RETURN = 5;
const VALUE_FLOOR_BASE_RETURN = 25;
const VALUE_FLOOR_UPSIDE = 25;
const VALUE_FLOOR_MAX_SCORE = 0.65;
const MOMENTUM_MIN_UNIVERSE = 5;
const MOMENTUM_MIN_STDDEV = 5;
const MOMENTUM_FALLBACK_MEAN = 0;
const MOMENTUM_FALLBACK_STDDEV = 20;

interface MomentumStats {
	mean: number;
	stddev: number;
}

function computeMomentumStats(stocks: FindingStock[]): MomentumStats {
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

function computeQualityBonus(stock: FindingStock): number {
	const m = stock.metrics;
	if (!m) return 0;
	let bonus = 0;

	// Part B: Return on Equity (Max 5 Points)
	let roeBonus = 0;
	const roe = parsePercent(m.roe);
	if (roe != null && roe > 0 && roe < 200) {
		roeBonus = Math.max(0, Math.min(5, (roe / 25) * 5));
	}

	// Hyper-rational adjustment: De-lever the ROE. High ROE driven by extreme debt is not "Quality".
	// If Net Debt / EBITDA > 3.0x, penalize the ROE bonus by 50%.
	const netDebt = m.netDebtEbitda;
	if (netDebt != null) {
		const debtStr = typeof netDebt === 'string' ? netDebt : String(netDebt);
		const debtMultiple = Number.parseFloat(debtStr.replace(/[^\d.-]/g, ''));
		// eslint-disable-next-line unicorn/no-zero-fractions
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

function deploymentRank(stock: FindingStock, momentum: MomentumStats): number {
	const base = stock.baseCagr ?? 0;
	const bear = stock.bearCagr ?? 0;
	const upside = Math.min(stock.upside ?? 0, 60);

	// All engines are now normalized (lower is better, 1.0 = threshold).
	// A score of 0.5 → strength 17.5, a score of 1.0 → strength 5.0, a score of 1.2+ → penalty.
	const score = stock.screener?.score ?? 1.2;
	const valuationStrength = Math.max(-25, (1.2 - score) * 25);

	// Cross-sectional momentum with short-term reversal skip (Jegadeesh & Titman 6-1 month).
	// Uses actual universe mean/stddev computed from all stocks, not fixed constants.
	const return6m = stock.screener?.realityChecks?.stabilization?.return6m ?? 0;
	const return1m = stock.screener?.realityChecks?.stabilization?.return1m ?? 0;
	const momentumInput = return6m - return1m;
	const momentumZScore =
		momentum.stddev > 0 ? (momentumInput - momentum.mean) / momentum.stddev : 0;

	// Aggressive Factor Weighting: Quantitative literature assigns roughly equal explanatory power to Value and Momentum.
	// We scale the Z-score by 7.5 and cap at +/- 15 points.
	let momentumBonus = Math.max(-15, Math.min(15, momentumZScore * 7.5));

	// Remove momentum penalty if we're buying a deep value floor
	if (momentumBonus < 0 && hasLikelyValueFloor(stock)) {
		momentumBonus = 0;
	}

	// Quality factor bonus (max +10 points) from ROE, FCF yield, Rule of 40.
	const qualityBonus = computeQualityBonus(stock);

	// Quantitative Conviction Score (QCS)
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

function hasLikelyValueFloor(stock: FindingStock): boolean {
	// Deep Cyclicals do not establish linear 'value floors'. A cyclical hitting a 3-month low
	// with a 'cheap' score is the exact definition of a cyclical value trap rolling over.
	if (stock.cyclical) return false;

	const stabilization = stock.screener?.realityChecks?.stabilization;
	const revisions = stock.screener?.realityChecks?.revisions;

	if (!stabilization?.near3mLow) return false;
	if (!revisions?.pass) return false;
	if ((revisions.up30d ?? 0) <= (revisions.down30d ?? 0)) return false;
	if ((stock.screener?.score ?? 99) > VALUE_FLOOR_MAX_SCORE) return false;
	if ((stock.upside ?? 0) < VALUE_FLOOR_UPSIDE) return false;

	return (
		(stock.bearCagr ?? -999) >= VALUE_FLOOR_BEAR_RETURN &&
		(stock.baseCagr ?? -999) >= VALUE_FLOOR_BASE_RETURN
	);
}

function deploymentForPass(stock: FindingStock): DeploymentInfo {
	const base = stock.baseCagr ?? -999;
	const basePass = base >= ETF_HURDLE_RETURN;
	const stabPass = stock.screener?.realityChecks?.stabilization?.pass !== false;

	if (basePass && stabPass) {
		return { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' };
	}

	if (!stabPass) {
		return {
			status: 'WAIT',
			reason: 'Falling knife (stabilization failed) \u2013 likely lagging analyst targets.'
		};
	}

	if (!basePass) {
		return {
			status: 'FAIL',
			reason: `Base forward return (${base}%) is below the ${ETF_HURDLE_RETURN}% hurdle.`
		};
	}

	return { status: 'FAIL', reason: 'Needs more conviction before deployment.' };
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
	const score = stock.screener?.score;
	const note = stock.screener?.note;
	const base = stock.baseCagr ?? -999;

	if ((score ?? 0) >= 1.5) {
		return {
			status: 'OVERPRICED',
			reason: note ?? `Extreme valuation (Score ${score}). Wait for compression.`
		};
	}

	// eslint-disable-next-line unicorn/no-zero-fractions
	if (score != null && score > 1.0) {
		return {
			status: 'FAIL',
			reason: note ?? `Valuation score ${score} is above the 1.0 buy threshold (lower is better).`
		};
	}

	// If score is technically "cheap" (< 1.0) but still FAIL signal, it's likely a hurdle issue
	if (base < ETF_HURDLE_RETURN) {
		return {
			status: 'FAIL',
			reason:
				note ??
				`Cheap (Score ${score}) but base return ${base}% misses the ${ETF_HURDLE_RETURN}% hurdle.`
		};
	}

	return { status: 'FAIL', reason: note ?? 'No valuation edge.' };
}

function assignDeployment(stock: FindingStock): void {
	const signal = stock.screener?.signal ?? 'NO_DATA';

	switch (signal) {
		case 'PASS': {
			stock.deployment = deploymentForPass(stock);
			break;
		}
		case 'WAIT': {
			stock.deployment = deploymentForWait(stock);
			break;
		}
		case 'REJECTED': {
			stock.deployment = {
				status: 'REJECT',
				reason: stock.screener?.note ?? 'Consensus is deteriorating.'
			};
			break;
		}
		case 'FAIL': {
			stock.deployment = deploymentForFail(stock);
			break;
		}
		case 'NO_DATA': {
			stock.deployment = {
				status: 'NO_DATA',
				reason: stock.screener?.note ?? 'Insufficient data.'
			};
			break;
		}
		default: {
			const _exhaustiveCheck: never = signal;
			stock.deployment = {
				status: 'NO_DATA',
				// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
				reason: `Unknown signal: ${_exhaustiveCheck}`
			};
		}
	}

	// Append cyclical warning universally
	if (stock.cyclical && stock.deployment.status !== 'NO_DATA') {
		stock.deployment.reason += ' (CYCLICAL EPS)';
	}
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
		enrichedStock.deployment?.status === 'DEPLOY' ? deploymentRank(enrichedStock, momentum) : null;

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
			etfCagr: ETF_HURDLE_RETURN
		},
		counts: buildCounts(enrichedStocks, deployNow, cheapWait, watchlist)
	};
}
