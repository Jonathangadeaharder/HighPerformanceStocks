import { parsePercent } from '../../lib/finance-core.js';
import { parseNumber } from './display-formatters.js';
import type {
	EarningsTrend,
	GrowthBranch,
	HistoricalData,
	RealityChecks,
	
	ScreenerResult,
	ScreenerStock,
	YahooSummary
} from './screener-types.js';
import { ENGINE_THRESHOLDS } from './screener-types.js';

const GROWTH_ROUTING_THRESHOLD = 8;
const CV_BENCHMARK = 0.08;
const R2_NOISE = 0.6;
const TOTAL_RETURN_THRESHOLD = 12.0;
const DEBT_PENALTY_THRESHOLD = 150;
const DEBT_PENALTY_FACTOR = 0.3;
const STABILIZATION_6M_THRESHOLD = -10;
const STABILIZATION_1M_THRESHOLD = 0;
const STABILIZATION_LOW_BUFFER = 1.05;
const ETF_HURDLE_RETURN = 15;
const BORDERLINE_WAIT_THRESHOLD = 1.2;

function getAnalystDispersion(earningsTrend: EarningsTrend | undefined): { avg: number; low: number; high: number } | null {
	if (!earningsTrend?.trend) return null;

	const entry = earningsTrend.trend.find((trend) => trend.period === '+1y');
	if (!entry?.earningsEstimate) return null;

	const { avg, low, high } = entry.earningsEstimate;
	if (avg == null || low == null || high == null || avg <= 0) return null;
	return { avg, low, high };
}

function computeGrowthScore(engine: keyof typeof ENGINE_THRESHOLDS, multipleType: string, multiple: number, growthPct: number, cvStock: number): ScreenerResult {
	const riskMultiplier = 1 + R2_NOISE * (cvStock - CV_BENCHMARK);
	const score = (multiple / growthPct) * riskMultiplier;
	const threshold = ENGINE_THRESHOLDS[engine] ?? 1.0;

	let signal: 'PASS' | 'FAIL' | 'WAIT';
	if (score <= threshold) {
		signal = 'PASS';
	} else if (score <= BORDERLINE_WAIT_THRESHOLD) {
		signal = 'WAIT';
	} else {
		signal = 'FAIL';
	}

	return {
		engine,
		score: +score.toFixed(2),
		signal,
		inputs: {
			growth: growthPct,
			multipleType,
			multiple: +multiple.toFixed(1),
			cvStock: +cvStock.toFixed(3),
			riskMultiplier: +riskMultiplier.toFixed(3)
		}
	};
}

function detectGrowthBranch(stock: ScreenerStock, valuationPrice: number | null | undefined): GrowthBranch {
	const basis = stock.cagrModel?.basis ?? '';
	const lowerBasis = basis.toLowerCase();
	const valuation = stock.valuation ?? {};
	const ttmBasis = stock.cagrModel?.ttmEPS;
	const priceToBasis = valuationPrice != null && ttmBasis != null && ttmBasis > 0 ? valuationPrice / ttmBasis : null;

	if (
		(lowerBasis.includes('serial acquirer') || stock.group === 'Serial Acquirers') &&
		valuation.evEbitda != null &&
		valuation.evEbitda > 0
	) {
		return {
			engine: 'fEVG',
			multipleType: 'EV/EBITDA',
			multiple: valuation.evEbitda
		};
	}

	if (/fee-related earnings|\bfre\b/.test(lowerBasis)) {
		return {
			engine: 'fFREG',
			multipleType: 'P/FRE',
			multiple: parseNumber(valuation.priceToFRE) ?? priceToBasis
		};
	}

	if (/adjusted net income|\bani\b|distributable earnings/.test(lowerBasis)) {
		return {
			engine: 'fANIG',
			multipleType: 'P/ANI',
			multiple: priceToBasis
		};
	}

	if (
		/price-to-fcf|price-to-cf|price-to-dcf|operating cfo|distributable cf|fcfa2s|cash flow/.test(
			lowerBasis
		)
	) {
		const hasEvFcf = valuation.evFcf != null;
		return {
			engine: 'fCFG',
			multipleType: hasEvFcf ? 'EV/FCF' : 'P/CF',
			multiple: hasEvFcf ? valuation.evFcf : priceToBasis
		};
	}

	if ((!valuation.forwardPE || valuation.forwardPE <= 0) && priceToBasis != null && priceToBasis > 0) {
			return {
				engine: 'tPERG',
				multipleType: 'Trailing P/E',
				multiple: priceToBasis
			};
		}

	return {
		engine: 'fPERG',
		multipleType: 'Forward P/E',
		multiple: valuation.forwardPE
	};
}

function computeTotalReturn(growthPct: number, divYieldPct: number, forwardPE: number, debtToEquity: number): ScreenerResult {
	const earningsYield = (1 / forwardPE) * 100;
	if (earningsYield <= divYieldPct) {
		return {
			engine: 'totalReturn',
			score: null,
			signal: 'FAIL',
			note: 'Dividend exceeds forward earnings (value trap)',
			inputs: {
				growth: growthPct,
				dividendYield: divYieldPct,
				earningsYield: +earningsYield.toFixed(1)
			}
		};
	}

	const hasPenalty = debtToEquity > DEBT_PENALTY_THRESHOLD;
	const baseReturn = divYieldPct + growthPct;
	const riskAdjReturn = hasPenalty ? baseReturn * (1 - DEBT_PENALTY_FACTOR) : baseReturn;

	const normalizedScore = TOTAL_RETURN_THRESHOLD / riskAdjReturn;

	return {
		engine: 'totalReturn',
		score: +normalizedScore.toFixed(2),
		signal: riskAdjReturn >= TOTAL_RETURN_THRESHOLD ? 'PASS' : 'FAIL',
		inputs: {
			growth: growthPct,
			dividendYield: divYieldPct,
			debtToEquity: +(debtToEquity ?? 0).toFixed(0),
			debtPenalty: hasPenalty,
			rawReturn: +riskAdjReturn.toFixed(1)
		}
	};
}

function applyRealityChecks(result: ScreenerResult, rawPrice: number | null | undefined, historicalData: HistoricalData | undefined, summary: YahooSummary | undefined): void {
	const checks: RealityChecks = {};
	const price6mAgo = historicalData?.price6mAgo;
	const price1mAgo = historicalData?.price1mAgo;
	const low3m = historicalData?.low3m;

	if (
		rawPrice != null &&
		price6mAgo != null &&
		price1mAgo != null &&
		low3m != null &&
		price6mAgo > 0 &&
		price1mAgo > 0 &&
		low3m > 0
	) {
		const return6m = (rawPrice / price6mAgo - 1) * 100;
		const return1m = (rawPrice / price1mAgo - 1) * 100;
		const near3mLow = rawPrice <= low3m * STABILIZATION_LOW_BUFFER;
		const stillFalling =
			return6m < STABILIZATION_6M_THRESHOLD && return1m < STABILIZATION_1M_THRESHOLD && near3mLow;

		checks.stabilization = {
			pass: !stillFalling,
			price: +rawPrice.toFixed(2),
			price6mAgo: +price6mAgo.toFixed(2),
			price1mAgo: +price1mAgo.toFixed(2),
			low3m: +low3m.toFixed(2),
			return6m: +return6m.toFixed(1),
			return1m: +return1m.toFixed(1),
			near3mLow
		};
	}

	const entry = summary?.earningsTrend?.trend?.find((trend) => trend.period === '+1y');
	const revisions = entry?.epsRevisions;
	const up30d = revisions?.upLast30days ?? 0;
	const down30d = revisions?.downLast30days ?? 0;
	// Require >= 3 downgrades with 0 upgrades to reject (avoid false positives from single analyst moves)
	const consensusCollapsing = down30d >= 3 && up30d === 0;
	checks.revisions = { pass: !consensusCollapsing, up30d, down30d };

	if (consensusCollapsing) {
		result.signal = 'REJECTED';
		result.note = 'Consensus actively collapsing (analyst lag)';
	}

	const history = summary?.earningsHistory?.history;
	if (Array.isArray(history) && history.length > 0) {
		const latest = history.at(-1);
		const actual = latest?.epsActual;
		const estimate = latest?.epsEstimate;
		if (actual != null && estimate != null && Math.abs(estimate) > 0.01) {
			const surprise = ((actual - estimate) / Math.abs(estimate)) * 100;
			const quarter = latest?.quarter
				? new Date(latest.quarter).toISOString().slice(0, 7)
				: 'unknown';
			checks.earningsSurprise = { surprise: +surprise.toFixed(1), quarter };
			if (surprise < -10 && result.signal === 'PASS') {
				result.note = result.note ? result.note + ' (Recent earnings miss)' : 'Recent earnings miss';
			}
		}
	}

	result.realityChecks = checks;
}

export function computeScreener(stock: ScreenerStock, summary: YahooSummary | undefined, rawPrice: number | null | undefined, valuationPrice: number | null | undefined, historicalData: HistoricalData | undefined): ScreenerResult {
	const model = stock.cagrModel;
	const growthPct = parsePercent(model?.epsGrowth);
	if (growthPct == null) return { engine: 'N/A', signal: 'NO_DATA', note: 'Missing growth data' };

	const isPreProfit = model?.ttmEPS != null && model.ttmEPS <= 0;
	if (isPreProfit) {
		return { engine: 'N/A', signal: 'NO_DATA', note: 'Pre-profit; screener not applicable' };
	}

	if (growthPct > GROWTH_ROUTING_THRESHOLD) {
		const divYieldPct = parsePercent(model?.dividendYield) ?? 0;
		if (divYieldPct < 5.0) {
			const branch = detectGrowthBranch(stock, valuationPrice);
			if (!branch.multiple || branch.multiple <= 0) {
				return {
					engine: branch.engine,
					signal: 'NO_DATA',
					note: `Missing/negative ${branch.multipleType}`
				};
			}

			const dispersion = getAnalystDispersion(summary?.earningsTrend);
			let cvStock = CV_BENCHMARK;
			if (dispersion) {
				cvStock = (dispersion.high - dispersion.low) / 4 / dispersion.avg;
			}

			const result = computeGrowthScore(
				branch.engine as keyof typeof ENGINE_THRESHOLDS,
				branch.multipleType,
				branch.multiple,
				growthPct,
				cvStock
			);

			const baseCagr = parsePercent(model?.scenarios?.base);
			if (result.signal === 'PASS' && baseCagr != null && baseCagr < ETF_HURDLE_RETURN) {
				result.signal = 'FAIL';
				result.note = `Cheap (${result.score}) but base return ${baseCagr}% misses the ${ETF_HURDLE_RETURN}% hurdle`;
			}

			applyRealityChecks(result, rawPrice, historicalData, summary);

			if (branch.engine !== 'fPERG' && branch.engine !== 'tPERG') {
				const fpe = stock.valuation?.forwardPE;
				if (fpe != null && fpe > 0) {
					const fPERGCheck = computeGrowthScore('fPERG', 'Forward P/E', fpe, growthPct, cvStock);
					result.secondaryEngine = 'fPERG';
					result.secondaryScore = fPERGCheck.score;
				}
			}

			if (!dispersion) {
				result.note = result.note
					? result.note + ' (Used benchmark CV)'
					: 'Used benchmark CV (missing dispersion data)';
			}

			if (stock.cyclical) {
				result.note = result.note ? result.note + ' (CYCLICAL EPS)' : '(CYCLICAL EPS)';
			}

			return result;
		}
	}

	let forwardPE = stock.valuation?.forwardPE;
	if (!forwardPE || forwardPE <= 0) {
		const ttmBasis = stock.cagrModel?.ttmEPS;
		if (valuationPrice != null && ttmBasis != null && ttmBasis > 0) {
			forwardPE = valuationPrice / ttmBasis;
		} else {
			return {
				engine: 'totalReturn',
				signal: 'NO_DATA',
				note: 'Missing/negative forward PE and no trailing EPS fallback'
			};
		}
	}

	const divYieldPct = parsePercent(model?.dividendYield) ?? 0;
	const debtToEquity = summary?.financialData?.debtToEquity ?? 0;
	const result = computeTotalReturn(growthPct, divYieldPct, forwardPE, debtToEquity);

	if (stock.cyclical) {
		result.note = result.note ? result.note + ' (CYCLICAL EPS)' : '(CYCLICAL EPS)';
	}

	applyRealityChecks(result, rawPrice, historicalData, summary);

	return result;
}



export {type ScreenerInputs, type ScreenerResult, type RealityChecks} from './screener-types.js';