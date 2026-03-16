import { calcDecayedCagr, parseDisplayPrice, parsePercent } from '../../../lib/finance-core.js';
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
	if (values.length < MOMENTUM_MIN_UNIVERSE) {
		return { mean: MOMENTUM_FALLBACK_MEAN, stddev: MOMENTUM_FALLBACK_STDDEV };
	}
	const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
	const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (values.length - 1);
	return { mean: +mean.toFixed(2), stddev: +Math.max(MOMENTUM_MIN_STDDEV, Math.sqrt(variance)).toFixed(2) };
}

function computeQualityBonus(stock: FindingStock): number {
	const m = stock.metrics;
	if (!m) return 0;
	let bonus = 0;

	let roeBonus = 0;
	const roe = parsePercent(m.roe);
	if (roe != null && roe > 0 && roe < 200) {
		if (roe >= 25) roeBonus = 4;
		else if (roe >= 20) roeBonus = 3;
		else if (roe >= 15) roeBonus = 2;
		else if (roe >= 10) roeBonus = 1;
	}

	// Hyper-rational adjustment: De-lever the ROE. High ROE driven by extreme debt is not "Quality".
	// If Net Debt / EBITDA > 3.0x, penalize the ROE bonus by 50%.
	if (m.netDebtEbitda && typeof m.netDebtEbitda === 'string') {
		const debtMultiple = Number.parseFloat(m.netDebtEbitda.replace('x', ''));
		if (!Number.isNaN(debtMultiple) && debtMultiple > 3.0) {
			roeBonus *= 0.5;
		}
	}
	bonus += roeBonus;

	const fcfYield = parsePercent(m.fcfYield);
	if (fcfYield != null) {
		if (fcfYield >= 6) bonus += 3;
		else if (fcfYield >= 4) bonus += 2;
		else if (fcfYield >= 3) bonus += 1;
	}

	const r40 = parsePercent(m.ruleOf40);
	if (r40 != null) {
		if (r40 >= 60) bonus += 3;
		else if (r40 >= 50) bonus += 2;
		else if (r40 >= 40) bonus += 1;
	}

	return bonus;
}

function computeSensitivityCagr(stock: FindingStock): number | null {
	const model = stock.cagrModel;
	if (!model?.exitPE?.base || !model.epsGrowth || !model.ttmEPS) return null;
	const currentPrice = parseDisplayPrice(stock.currentPrice);
	if (currentPrice == null || currentPrice <= 0) return null;
	const epsGrowth = parsePercent(model.epsGrowth);
	if (epsGrowth == null) return null;
	const dyPct = parsePercent(model.dividendYield) ?? 0;
	const decayFactor = typeof model.decayFactor === 'number' ? model.decayFactor : undefined;
	const cagr = calcDecayedCagr({
		price: currentPrice,
		ttmEPS: model.ttmEPS,
		epsGrowthPct: epsGrowth - 3,
		exitPE: model.exitPE.base,
		dividendYieldPct: dyPct,
		...(decayFactor !== undefined && { decayFactor })
	});
	return +cagr.toFixed(1);
}

function selectDiverseTopPicks(deployNow: FindingStock[], maxPicks: number, maxPerGroup: number): FindingStock[] {
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
	// A score of 0.5 → strength 17.5, a score of 1.0 → strength 5.0, a score of 1.2+ → 0.
	const valuationStrength = Math.max(0, 1.2 - (stock.screener?.score ?? 99)) * 25;

	// Cross-sectional momentum with short-term reversal skip (Jegadeesh & Titman 6-1 month).
	// Uses actual universe mean/stddev computed from all stocks, not fixed constants.
	const return6m = stock.screener?.realityChecks?.stabilization?.return6m ?? 0;
	const return1m = stock.screener?.realityChecks?.stabilization?.return1m ?? 0;
	const momentumInput = return6m - return1m;
	const momentumZScore = Math.max(-2, Math.min(2, (momentumInput - momentum.mean) / momentum.stddev));
	
	// Aggressive Factor Weighting: Quantitative literature assigns roughly equal explanatory power to Value and Momentum.
	// We scale the Z-score by 7.5 to provide a +/- 15 point differential, ensuring highly significant 
	// price-action confirmation aggressively pulls fundamentally sound stocks to the top of the pile.
	const momentumBonus = momentumZScore * 7.5;

	// Quality factor bonus (max +10 points) from ROE, FCF yield, Rule of 40.
	const qualityBonus = computeQualityBonus(stock);

	return +(valuationStrength + base * 1.2 + bear * 0.8 + upside * 0.1 + momentumBonus + qualityBonus).toFixed(1);
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
	const base = stock.baseCagr ?? -999;
	const bear = stock.bearCagr ?? -999;
	const basePass = base >= ETF_HURDLE_CAGR;
	const bearPass = bear > BEAR_FLOOR_CAGR;

	if (basePass && bearPass) {
		return { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' };
	}

	if (!basePass) {
		return {
			status: 'FAIL',
			reason: `Base CAGR (${base}%) is below the ${ETF_HURDLE_CAGR}% ETF hurdle.`
		};
	}

	return {
		status: 'FAIL',
		reason: `Bear case CAGR (${bear}%) is below the ${BEAR_FLOOR_CAGR}% floor required for deployment.`
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
	const score = stock.screener?.score;
	const note = stock.screener?.note;
	const base = stock.baseCagr ?? -999;
	const bear = stock.bearCagr ?? -999;

	if (epsGrowth >= 20 && (score ?? 0) >= 1.5) {
		return {
			status: 'OVERPRICED',
			reason: note ?? `Hyper-growth (${epsGrowth}%) at extreme valuation (Score ${score}). Wait for compression.`
		};
	}

	if (score != null && score > 1.0) {
		return {
			status: 'FAIL',
			reason: note ?? `Valuation score ${score} is above the 1.0 buy threshold (lower is better).`
		};
	}

	// If score is technically "cheap" (< 1.0) but still FAIL signal, it's likely a hurdle issue
	if (base < ETF_HURDLE_CAGR) {
		return {
			status: 'FAIL',
			reason: note ?? `Cheap (Score ${score}) but base CAGR ${base}% misses the ${ETF_HURDLE_CAGR}% hurdle.`
		};
	}

	if (bear <= BEAR_FLOOR_CAGR) {
		return {
			status: 'FAIL',
			reason: note ?? `Cheap (Score ${score}) but bear CAGR ${bear}% is below the ${BEAR_FLOOR_CAGR}% safety floor.`
		};
	}

	return { status: 'FAIL', reason: note ?? 'No valuation edge.' };
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
	enrichedStock.sensitivityCagr = computeSensitivityCagr(enrichedStock);

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
			etfCagr: ETF_HURDLE_CAGR,
			bearFloor: BEAR_FLOOR_CAGR
		},
		counts: buildCounts(enrichedStocks, deployNow, cheapWait, watchlist)
	};
}
