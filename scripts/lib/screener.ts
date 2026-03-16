import { parsePercent } from '../../lib/finance-core.js';
import { parseNumber } from './display-formatters.js';

const GROWTH_ROUTING_THRESHOLD = 8;
const CV_BENCHMARK = 0.08;
const R2_NOISE = 0.6;
const TOTAL_RETURN_THRESHOLD = 12.0;
const DEBT_PENALTY_THRESHOLD = 150;
const DEBT_PENALTY_FACTOR = 0.3;
const STABILIZATION_6M_THRESHOLD = -10;
const STABILIZATION_1M_THRESHOLD = 0;
const STABILIZATION_LOW_BUFFER = 1.05;
const ETF_HURDLE_CAGR = 14;

const ENGINE_THRESHOLDS = {
	fPERG: 1.0,
	tPERG: 1.0,
	fEVG: 0.6,
	fFREG: 0.6,
	fANIG: 0.8,
	fCFG: 0.8
};

function getAnalystDispersion(earningsTrend) {
	if (!earningsTrend?.trend) return null;

	const entry = earningsTrend.trend.find((trend) => trend.period === '+1y');
	if (!entry?.earningsEstimate) return null;

	const { avg, low, high } = entry.earningsEstimate;
	if (avg == null || low == null || high == null || avg <= 0) return null;
	return { avg, low, high };
}

export interface ScreenerResult {
	engine: string;
	score?: number | null;
	signal: string;
	inputs?: any;
	note?: string;
	secondaryEngine?: string;
	secondaryScore?: number | null;
	realityChecks?: any;
}

function computeGrowthScore(engine: string, multipleType: string, multiple: number, growthPct: number, cvStock: number): ScreenerResult {
	const riskMultiplier = 1 + R2_NOISE * (cvStock - CV_BENCHMARK);
	const score = (multiple / growthPct) * riskMultiplier;
	const threshold = ENGINE_THRESHOLDS[engine] ?? 1.0;

	return {
		engine,
		score: +score.toFixed(2),
		signal: score <= threshold ? 'PASS' : 'FAIL',
		inputs: {
			growth: growthPct,
			multipleType,
			multiple: +multiple.toFixed(1),
			cvStock: +cvStock.toFixed(3),
			riskMultiplier: +riskMultiplier.toFixed(3)
		}
	};
}

function detectGrowthBranch(stock, valuationPrice) {
	const basis = stock.cagrModel?.basis ?? '';
	const lowerBasis = basis.toLowerCase();
	const valuation = stock.valuation ?? {};
	const ttmBasis = stock.cagrModel?.ttmEPS;
	const priceToBasis = valuationPrice != null && ttmBasis > 0 ? valuationPrice / ttmBasis : null;

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
		return {
			engine: 'fCFG',
			multipleType: valuation.evFcf != null ? 'EV/FCF' : 'P/CF',
			multiple: parseNumber(valuation.evFcf) ?? priceToBasis
		};
	}

	if (
		(/serial acquirer|amortization/.test(lowerBasis) || stock.group === 'Serial Acquirers') &&
		valuation.evEbitda != null &&
		valuation.evEbitda > 0
	) {
		return {
			engine: 'fEVG',
			multipleType: 'EV/EBITDA',
			multiple: valuation.evEbitda
		};
	}

	if (!valuation.forwardPE || valuation.forwardPE <= 0) {
		if (priceToBasis != null && priceToBasis > 0) {
			return {
				engine: 'tPERG',
				multipleType: 'Trailing P/E',
				multiple: priceToBasis
			};
		}
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

	// Normalize score: Price / Expected Return. Lower is better. 1.0 is the hurdle rate.
	// We want 12% to be 1.0. 24% to be 0.5. 8% to be 1.5.
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

function applyRealityChecks(result, rawPrice, historicalData, summary) {
	const checks: Record<string, any> = {};
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
	const passed = !(down30d > 0 && up30d === 0);
	checks.revisions = { pass: passed, up30d, down30d };

	if (!passed) {
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
			const quarter = latest.quarter
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

export function computeScreener(stock, summary, rawPrice, valuationPrice, historicalData) {
	const model = stock.cagrModel;
	// PEG screener uses RAW analyst growth estimates (no haircut).
	// Bordalo et al. (2019) prove analyst forecasts contain a "kernel of truth":
	// the relative ordering is informative even though absolute levels are biased.
	// The RTM bias adjustment is applied only in the CAGR scenario calculator (update-data.ts).
	const growthPct = parsePercent(model?.epsGrowth);
	if (growthPct == null) return { engine: 'N/A', signal: 'NO_DATA', note: 'Missing growth data' };

	const isPreProfit = model.exitPE && Object.values(model.exitPE).every((value) => value === 0);
	if (isPreProfit) {
		return { engine: 'N/A', signal: 'NO_DATA', note: 'Pre-profit; screener not applicable' };
	}

	if (growthPct > GROWTH_ROUTING_THRESHOLD) {
		const divYieldPct = parsePercent(model.dividendYield) || 0;
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
				branch.engine,
				branch.multipleType,
				branch.multiple,
				growthPct,
				cvStock
			);

			// CAGR sanity gate: cheap valuation is meaningless if forward returns are poor
			const baseCagr = parsePercent(model?.scenarios?.base);
			if (result.signal === 'PASS' && baseCagr != null && baseCagr < ETF_HURDLE_CAGR) {
				result.signal = 'FAIL';
				result.note = `Cheap (${result.score}) but base CAGR ${baseCagr}% misses the ${ETF_HURDLE_CAGR}% hurdle`;
			}

			if (true) {
				applyRealityChecks(result, rawPrice, historicalData, summary);
			}

			// Ensemble cross-check: compute fPERG as secondary reference for specialized engines.
			// Specialized engine stays primary (no signal override); fPERG is transparency only.
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
		if (valuationPrice != null && ttmBasis > 0) {
			forwardPE = valuationPrice / ttmBasis;
		} else {
			return {
				engine: 'totalReturn',
				signal: 'NO_DATA',
				note: 'Missing/negative forward PE and no trailing EPS fallback'
			};
		}
	}

	const divYieldPct = parsePercent(model.dividendYield) || 0;
	const debtToEquity = summary?.financialData?.debtToEquity ?? 0;
	const result = computeTotalReturn(growthPct, divYieldPct, forwardPE, debtToEquity);

	if (stock.cyclical) {
		result.note = result.note ? result.note + ' (CYCLICAL EPS)' : '(CYCLICAL EPS)';
	}

	if (true) {
		applyRealityChecks(result, rawPrice, historicalData, summary);
	}

	return result;
}
