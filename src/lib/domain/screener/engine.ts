import { parsePercent } from '../finance/core';
import type {
	EarningsTrend,
	GrowthBranch,
	HistoricalData,
	RealityChecks,
	ScreenerResult,
	ScreenerStock,
	YahooSummary
} from './types';
import { ENGINE_THRESHOLDS } from './types';

const CV_BENCHMARK = 0.08;
const TOTAL_RETURN_THRESHOLD = 12;
const STABILIZATION_LOW_BUFFER = 1.05;
export const ETF_HURDLE_RETURN = 15;
const BORDERLINE_WAIT_THRESHOLD = 1.2;

/**
 * Computes a dynamically adjusted hurdle rate.
 * Deducts a lag-discount when analysts are overwhelmingly upgrading.
 */
export function computeEffectiveHurdle(up30d: number = 0, down30d: number = 0): number {
	if (up30d >= 10 && up30d >= 2 * down30d) return 10;
	if (up30d >= 5 && up30d >= 2 * down30d) return 12;
	return ETF_HURDLE_RETURN;
}

// --- Component 1: Hyper-Growth Exponential Decay ---
// Replaces the linear cap with a bounded exponential fade.
// Mauboussin base-rate data: sustained >30% CAGR is a multi-sigma anomaly.
const HYPERGROWTH_THRESHOLD = 30;
const HYPERGROWTH_CEILING = 10; // max effective excess above threshold → caps at 40%

// --- Component 2: Analyst Dispersion Convex Penalty ---
// Replaces the linear R2_NOISE scaling with a power-law convex penalty.
// AFD literature: top-quintile dispersion causes -7.7% to -14.0% annualized alpha drag.
const CV_SAFE_THRESHOLD = 0.1;
const CV_POWER_EXPONENT = 2;
const CV_LAMBDA = 15;

// --- Component 3: ROIC-Adjusted Dynamic PEG Ceilings ---
// Replaces static 1.5x/2.0x sector caps with dynamic ROIC/WACC-driven ceiling.
const PEG_BASE = 1.25;
const PEG_GAMMA = 0.65;
const PEG_MAX_CAP = 3;
const WACC_PROXY = 9; // long-run US equity cost of capital proxy (%)

// --- Component 4: Continuous Leverage Sigmoid ---
// Replaces the binary -30% D/E cliff with a continuous logistic penalty.
// Phase 2: Prefers ICR (Interest Coverage Ratio) when available for higher fidelity.
const LEVERAGE_P_MAX = 0.35;
const LEVERAGE_DE_MID = 200;
const LEVERAGE_K = 0.02;
// ICR-based sigmoid parameters (Altman Z-score calibrated)
const ICR_MID = 3; // inflection at 3x coverage
const ICR_K = 1.5; // steepness

// --- Component 5: Beta-Adaptive Momentum Buffer ---
// Replaces static -10%/0% thresholds with beta-scaled dynamic thresholds.
const STAB_6M_BASE = -10;
const STAB_1M_BASE = -3;
const BETA_MIN_CLAMP = 0.5;
const BETA_MAX_CLAMP = 2;
const BETA_DEFAULT = 1;

// Phase 2: Full VAMS (Volatility-Adjusted Momentum Score) rejection threshold.
// Blended multi-horizon z-score below this triggers falling-knife rejection.
// -1.25σ balances sensitivity: catches genuine structural breakdowns while
// allowing normal rotational noise on high-volatility assets.
const VAMS_REJECT_THRESHOLD = -1.25;
const FORWARD_PE_LABEL = 'Forward P/E';
// DEPLOY CAGRs are hardcoded (15 for PASS, 20 for WAIT)
/**
 * Collapsing-consensus hard reject: fired when BOTH conditions hold:
 *   (a) down30d >= COLLAPSE_RATIO * up30d  (overwhelming downgrade dominance)
 *   (b) down30d >= COLLAPSE_MIN_ABS        (minimum absolute count to avoid noise)
 * The simpler legacy rule (down >= threshold && up === 0) is retained as a fallback.
 */
const COLLAPSE_RATIO = 2;
const COLLAPSE_MIN_ABS = 5;

/**
 * Parses numeric values from various formats.
 */
function parseNumber(value: string | number | null | undefined): number | null {
	if (value == null) return null;
	if (typeof value === 'number') return value;
	const cleaned = value.replaceAll(/[^\d.-]/g, '');
	const num = Number.parseFloat(cleaned);
	return Number.isNaN(num) ? null : num;
}

/**
 * Appends a note to the result, wrapping in parentheses if appending to an existing note.
 */
function appendNote(result: ScreenerResult, note: string): void {
	result.note = result.note ? `${result.note} (${note})` : note;
}

function getAnalystDispersion(
	earningsTrend: EarningsTrend | undefined
): { avg: number; low: number; high: number } | null {
	if (!earningsTrend?.trend) return null;

	const entry = earningsTrend.trend.find((trend) => trend.period === '+1y');
	if (!entry?.earningsEstimate) return null;

	const { avg, low, high } = entry.earningsEstimate;
	if (avg == null || low == null || high == null || avg <= 0) return null;
	return { avg, low, high };
}

/**
 * Component 1: Bounded exponential decay for hyper-growth.
 * Below HYPERGROWTH_THRESHOLD, growth passes through unchanged.
 * Above it, excess growth is compressed via 1 - e^(-x/C_max),
 * asymptotically approaching threshold + HYPERGROWTH_CEILING.
 */
export function computeEffectiveGrowth(growthPct: number): number {
	if (growthPct <= HYPERGROWTH_THRESHOLD) return growthPct;
	const excess = growthPct - HYPERGROWTH_THRESHOLD;
	return HYPERGROWTH_THRESHOLD + HYPERGROWTH_CEILING * (1 - Math.exp(-excess / HYPERGROWTH_CEILING));
}

/**
 * Component 2: Convex power-law penalty for analyst dispersion.
 * Returns a risk multiplier ≥ 1.0.
 * Below CV_SAFE_THRESHOLD, no penalty (multiplier = 1.0).
 * Above it, penalty scales as λ * (CV - τ)^κ.
 */
export function computeDispersionMultiplier(cvStock: number): number {
	const excess = Math.max(0, cvStock - CV_SAFE_THRESHOLD);
	return 1 + CV_LAMBDA * Math.pow(excess, CV_POWER_EXPONENT);
}

/**
 * Component 4: Continuous logistic leverage penalty (D/E-based).
 * Returns a penalty fraction in [0, LEVERAGE_P_MAX] (~0–35%).
 * Replaces the binary -30% cliff at D/E > 150%.
 */
export function computeLeveragePenalty(debtToEquity: number): number {
	return LEVERAGE_P_MAX / (1 + Math.exp(LEVERAGE_K * (LEVERAGE_DE_MID - debtToEquity)));
}

/**
 * Component 4 Phase 2: ICR-based leverage penalty (higher fidelity).
 * Uses Interest Coverage Ratio when available.
 * Low ICR (< 1.5x) → high penalty; High ICR (> 8x) → near-zero penalty.
 * The sigmoid is inverted compared to D/E: higher ICR = lower risk.
 */
export function computeLeveragePenaltyICR(icr: number): number {
	// Inverted sigmoid: penalty decreases as ICR increases
	return LEVERAGE_P_MAX / (1 + Math.exp(ICR_K * (icr - ICR_MID)));
}

/**
 * Component 3: Dynamic ROIC-adjusted PEG ceiling.
 * Returns the maximum allowable implied PEG for a given capital efficiency.
 * Falls back to ROE if ROIC is unavailable, or to static caps if both are null.
 */
export function computeDynamicPegCeiling(
	roicPct: number | null,
	roePct: number | null
): number | null {
	// Use ROIC, falling back to ROE, falling back to null (triggers static caps)
	const capitalReturn = roicPct ?? roePct;
	if (capitalReturn == null || capitalReturn <= 0) return null;

	const ratio = Math.max(1, capitalReturn / WACC_PROXY);
	const ceiling = PEG_BASE + PEG_GAMMA * Math.log(ratio);
	return Math.min(PEG_MAX_CAP, ceiling);
}

function computeGrowthScore(
	engine: keyof typeof ENGINE_THRESHOLDS,
	multipleType: string,
	multiple: number,
	growthPct: number,
	cvStock: number
): ScreenerResult {
	// Component 1: Exponential fade for hyper-growth
	const effectiveGrowth = computeEffectiveGrowth(growthPct);

	// Component 2: Convex dispersion penalty
	const riskMultiplier = computeDispersionMultiplier(cvStock);

	const score = (multiple / effectiveGrowth) * riskMultiplier;
	const threshold = ENGINE_THRESHOLDS[engine] ?? 1.0;
	const waitThreshold = threshold === 1.0 ? BORDERLINE_WAIT_THRESHOLD : threshold * 1.2;

	let signal: 'PASS' | 'FAIL' | 'WAIT';
	let note: string | undefined;
	
	if (score <= threshold) {
		signal = 'PASS';
	} else if (score <= waitThreshold) {
		signal = 'WAIT';
		note = `Borderline valuation (Score ${score.toFixed(2)} vs ${threshold} limit)`;
	} else {
		signal = 'FAIL';
		note = `Valuation score ${score.toFixed(2)} exceeds ${threshold} limit`;
	}

	return {
		engine,
		score: +score.toFixed(2),
		signal,
		...(note ? { note } : {}),
		inputs: {
			growth: growthPct,
			multipleType,
			multiple: +multiple.toFixed(1),
			cvStock: +cvStock.toFixed(3),
			riskMultiplier: +riskMultiplier.toFixed(3)
		}
	};
}

export function detectGrowthBranch(
	stock: ScreenerStock,
	valuationPrice: number | null | undefined
): GrowthBranch {
	const basis = stock.cagrModel?.basis ?? '';
	const lowerBasis = basis.toLowerCase();
	const group = stock.group?.toLowerCase() ?? '';
	const valuation = stock.valuation ?? {};
	const ttmBasis = stock.cagrModel?.ttmEPS;
	const priceToBasis =
		valuationPrice != null && ttmBasis != null && ttmBasis > 0 ? valuationPrice / ttmBasis : null;

	if (group.includes('disqualified') || group.includes('pre-profit') || group.includes('binary')) {
		return {
			engine: 'DISQUALIFIED',
			multipleType: 'N/A',
			multiple: null
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

	// --- Pre-Profit Negative FCF Binary Refusal ---
	// If the asset is burning physical cash (negative EV/FCF) and trying to 
	// hallucinate a forward PE > 50 (or has TTM EPS < 0.5), mathematically reject it.
	if (valuation.evFcf != null && valuation.evFcf < 0) {
		const fpeForPreProfit = valuation.forwardPE;
		if (fpeForPreProfit != null && fpeForPreProfit > 50) {
			return {
				engine: 'DISQUALIFIED',
				multipleType: 'N/A',
				multiple: null
			};
		}
	}

	// --- Asset-Light Software Serial Acquirers fCFG routing ---
	// ROP, CSU.TO, TOI.V, LMN.V: Extremely low cap-ex aggregators tracking cash flow.
	const isSoftwareCompounder = lowerBasis.includes('software') || 
		lowerBasis.includes('asset-light') || 
		lowerBasis.includes('vms') || 
		lowerBasis.includes('fcfa2s') || 
		group.includes('software');

	// --- Serial acquirer / Capital Heavy fEVG routing ---
	// Highly capital intensive, aggregators, or industrials MUST be gated by EV/EBITDA.
	const isCapitalHeavyGroup =
		stock.group === 'Serial Acquirers' ||
		stock.group === 'Capital Compounders' ||
		stock.group === 'Robotics' ||
		stock.group === 'Industrial Monopolies' ||
		stock.group === 'Materials & Infrastructure' ||
		group.includes('industrial') ||
		group.includes('material') ||
		lowerBasis.includes('serial acquirer') ||
		lowerBasis.includes('ev/ebitda') ||
		lowerBasis.includes('infrastructure');

	if (isSoftwareCompounder) {
		const hasEvFcf = valuation.evFcf != null;
		return {
			engine: 'fCFG',
			multipleType: hasEvFcf ? 'EV/FCF' : 'P/CF',
			multiple: hasEvFcf ? valuation.evFcf! : priceToBasis
		};
	}

	if (isCapitalHeavyGroup) {
		return {
			engine: 'fEVG',
			multipleType: 'EV/EBITDA',
			multiple: valuation.evEbitda ?? null
		};
	}

	// --- AUTO RULE 1: fEVG for leveraged industrials (net debt ≥ 1.5x EBITDA) ---
	// Non-GAAP EPS aggressively backs out D&A on heavily debt-funded capex, causing
	// fPERG to drastically understate true economic leverage. Any stock with net
	// debt/EBITDA ≥ 1.5x must be evaluated on EV/EBITDA to properly price in the
	// cost of its capital structure. (RTX at 2.2x is the canonical example.)
	const netDebtRatioStr = stock.metrics?.netDebtEbitda ?? '';
	const netDebtRatioMatch = /^([\d.]+)x?$/i.exec(netDebtRatioStr);
	const netDebtRatio = netDebtRatioMatch ? parseFloat(netDebtRatioMatch[1] ?? '0') : null;
	if (netDebtRatio !== null && netDebtRatio >= 1.5 && valuation.evEbitda != null && valuation.evEbitda > 0) {
		return {
			engine: 'fEVG',
			multipleType: 'EV/EBITDA',
			multiple: valuation.evEbitda
		};
	}

	// --- AUTO RULE 2: fCFG for pre-profit platforms (ttmEPS is null/missing) ---
	// Pre-profit hyper-growth platforms (e.g. RBRK) have no valid EPS denominator.
	// Routing them to totalReturn via a 0% growth parse is a fatal mis-classification
	// that bypasses the required dividendYield ≥ 4% gate. Use EV/FCF instead.
	const isPreProfitPlatform = stock.cagrModel?.ttmEPS == null && valuation.evFcf != null && valuation.evFcf > 0;
	if (isPreProfitPlatform) {
		return {
			engine: 'fCFG',
			multipleType: 'EV/FCF',
			multiple: valuation.evFcf!
		};
	}

	// --- AUTO RULE 3: fCFG for high-FCF SBC-distorted platforms ---
	// Cybersecurity and SaaS platforms that (a) generate ≥ 25% FCF margins AND
	// (b) have ≥ 15% modelled growth AND (c) have a valid EV/FCF multiple are
	// systematically under-served by fPERG: their GAAP/non-GAAP EPS gap (caused
	// by heavy SBC, deferred-revenue accounting, or free-product transition periods)
	// inflates the apparent forward PE, generating false rejections.
	// Using EV/FCF as the primary anchor correctly prices the cash generation floor.
	// (Canonical examples: PANW, ZS, FTNT.)
	const fcfMarginStr = stock.metrics?.fcfMargin ?? '';
	const fcfMarginMatch = /([\d.]+)/.exec(fcfMarginStr);
	const fcfMarginPct = fcfMarginMatch ? parseFloat(fcfMarginMatch[1] ?? '0') : null;
	const growthNum = parseNumber(stock.cagrModel?.epsGrowth?.replace('%', ''));
	const isHighFcfPlatform =
		fcfMarginPct !== null &&
		fcfMarginPct >= 25 &&
		growthNum !== null &&
		growthNum >= 15 &&
		valuation.evFcf != null &&
		valuation.evFcf > 0 &&
		// Only apply to pure-software/SaaS/cybersecurity groups — not hardware, industrials, or royalties
		!/(hardware|semicon|industrial|equipment|royalt|stream|energy|financ)/i.test(group);
	if (isHighFcfPlatform) {
		return {
			engine: 'fCFG',
			multipleType: 'EV/FCF',
			multiple: valuation.evFcf!
		};
	}

	if (
		/price-to-fcf|price-to-cf|price-to-dcf|operating cfo|distributable cf|fcfa2s|fcf yield|cash flow|fcfbs/.test(
			lowerBasis
		) || group.includes('royalty') || group.includes('streamer') || stock.group === 'Healthcare Monopolies'
	) {
		const isStreamer = group.includes('royalt') || group.includes('stream');
		if (isStreamer && valuation.forwardPE != null && valuation.forwardPE > 0) {
			return {
				engine: 'fPERG',
				multipleType: FORWARD_PE_LABEL,
				multiple: valuation.forwardPE
			};
		}
		const hasEvFcf = valuation.evFcf != null;
		return {
			engine: 'fCFG',
			multipleType: hasEvFcf ? 'EV/FCF' : 'P/CF',
			multiple: hasEvFcf ? valuation.evFcf! : priceToBasis
		};
	}

	// --- Forward PE preference over trailing ---
	// When a valid forwardPE is available, always prefer it (fPERG).
	// tPERG / trailing fallback is only used when forwardPE is absent or negative.
	if (valuation.forwardPE != null && valuation.forwardPE > 0) {
		return {
			engine: 'fPERG',
			multipleType: FORWARD_PE_LABEL,
			multiple: valuation.forwardPE
		};
	}

	// --- Trailing fallback: only when no forwardPE is available ---
	if (priceToBasis != null && priceToBasis > 0) {
		return {
			engine: 'tPERG',
			multipleType: 'Trailing P/E',
			multiple: priceToBasis
		};
	}

	if (
		priceToBasis != null &&
		valuation.forwardPE != null &&
		priceToBasis > 0 &&
		priceToBasis < valuation.forwardPE
	) {
		return {
			engine: 'tPERG',
			multipleType: 'Peak-Adjusted P/E',
			multiple: priceToBasis
		};
	}

	return {
		engine: 'fPERG',
		multipleType: FORWARD_PE_LABEL,
		multiple: valuation.forwardPE ?? null
	};
}

function computeTotalReturn(
	growthPct: number,
	divYieldPct: number,
	forwardPE: number,
	debtToEquity: number,
	stock: ScreenerStock
): ScreenerResult {
	const earningsYield = (1 / forwardPE) * 100;

	if (divYieldPct < 4) {
		return {
			engine: 'totalReturn',
			score: null,
			signal: 'FAIL',
			note: `Dividend yield ${divYieldPct}% is below 4% minimum threshold for totalReturn engine`,
			inputs: {
				growth: growthPct,
				dividendYield: divYieldPct,
				earningsYield: +(earningsYield).toFixed(1)
			}
		};
	}

	const isRoyaltyOrMLP = /royalt|mlp|infrastructure/i.test(stock.group ?? '');
	if (earningsYield <= divYieldPct && !isRoyaltyOrMLP) {
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

	// Component 4: Continuous leverage sigmoid — prefer ICR when available
	const icrStr = stock.metrics?.interestCoverage;
	const icrParsed = icrStr ? parseNumber(icrStr) : null;
	const leveragePenalty = icrParsed != null && icrParsed > 0
		? computeLeveragePenaltyICR(icrParsed)
		: computeLeveragePenalty(debtToEquity);
	const baseReturn = divYieldPct + growthPct;
	const riskAdjReturn = baseReturn * (1 - leveragePenalty);

	const normalizedScore = riskAdjReturn > 0 ? TOTAL_RETURN_THRESHOLD / riskAdjReturn : 999;

	return {
		engine: 'totalReturn',
		score: +normalizedScore.toFixed(2),
		signal: riskAdjReturn >= TOTAL_RETURN_THRESHOLD ? 'PASS' : 'FAIL',
		inputs: {
			growth: growthPct,
			dividendYield: divYieldPct,
			debtToEquity: +(debtToEquity ?? 0).toFixed(0),
			debtPenalty: leveragePenalty > 0.01,
			rawReturn: +riskAdjReturn.toFixed(1)
		}
	};
}

function applyRealityChecks(
	result: ScreenerResult,
	rawPrice: number | null | undefined,
	historicalData: HistoricalData | undefined,
	summary: YahooSummary | undefined,
	stock: ScreenerStock
): void {
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

		// Phase 2: Full VAMS (Volatility-Adjusted Momentum Score) when ex-ante vol available
		const price3mAgo = historicalData?.price3mAgo;
		const exAnteVol = historicalData?.exAnteVol;
		let stillFalling: boolean;

		if (exAnteVol != null && exAnteVol > 0 && price3mAgo != null && price3mAgo > 0) {
			// Full VAMS: multi-horizon volatility-normalized momentum z-score
			const return3m = (rawPrice / price3mAgo - 1) * 100;
			const annualizedVol = exAnteVol; // already annualized %

			// Compute individual VAMS per horizon: return / (vol * sqrt(h/12))
			const vams1 = return1m / (annualizedVol * Math.sqrt(1 / 12));
			const vams3 = return3m / (annualizedVol * Math.sqrt(3 / 12));
			const vams6 = return6m / (annualizedVol * Math.sqrt(6 / 12));

			// Blended score: 50% short-term, 30% mid-term, 20% long-term
			const blendedVams = 0.5 * vams1 + 0.3 * vams3 + 0.2 * vams6;

			// Reject if blended score breaches -1.25σ AND near 3-month low
			stillFalling = blendedVams < VAMS_REJECT_THRESHOLD && near3mLow;
		} else {
			// Fallback: Phase 1 beta-adaptive momentum buffer
			const betaStr = stock.metrics?.beta ?? '';
			const betaRaw = parseNumber(betaStr);
			const beta = betaRaw != null && betaRaw > 0
				? Math.max(BETA_MIN_CLAMP, Math.min(BETA_MAX_CLAMP, betaRaw))
				: BETA_DEFAULT;
			const adjustedThreshold6m = STAB_6M_BASE * beta;
			const adjustedThreshold1m = STAB_1M_BASE * beta;

			stillFalling =
				return6m < adjustedThreshold6m && return1m < adjustedThreshold1m && near3mLow;
		}

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
	const isAltAsset =
		stock.group === 'Financials & Alt Assets' ||
		/fre|ani|fee-related|distributable/i.test(stock.cagrModel?.basis ?? '');
	const downgradeThreshold = isAltAsset ? 7 : 3;

	// Two-pronged consensus-collapse rule:
	// Rule A (legacy): overwhelmingly one-sided with zero upgrades
	const collapseRuleA = down30d >= downgradeThreshold && up30d === 0;
	// Rule B (ratio): down revisions dominate by 2:1+ AND there are at least COLLAPSE_MIN_ABS downgrades.
	//   This catches cases like 0700.HK (4 up / 19 down) and MELI (1 up / 11 down)
	//   that Rule A misses because up30d > 0.
	const collapseRuleB = down30d >= COLLAPSE_MIN_ABS && down30d >= COLLAPSE_RATIO * up30d;
	const consensusCollapsing = collapseRuleA || collapseRuleB;
	checks.revisions = { pass: !consensusCollapsing, up30d, down30d };

	if (consensusCollapsing && result.signal !== 'REJECTED') {
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
			if (surprise < -100 && result.engine === 'fPERG') {
				result.signal = 'FLAG FOR MANUAL REVIEW';
				result.note = 'Earnings miss > 100% broke P/E model structure.';
			} else if (surprise < -10 && result.signal === 'PASS') {
				appendNote(result, 'Recent earnings miss');
			}
		}
	}

	const tpe = stock.valuation?.trailingPE;
	const fpe = stock.valuation?.forwardPE;
	if ((result.engine === 'fPERG' || result.engine === 'tPERG') && tpe != null && fpe != null && fpe > 0 && tpe > 0) {
		const divergence = Math.abs(fpe - tpe) / Math.min(fpe, tpe);
		if (divergence > 3) {
			result.signal = 'FAIL';
			appendNote(result, 'Massive P/E divergence (>300%); potential data hallucination');
		}
	}

	result.realityChecks = checks;
}

/**
 * Component 3: Dynamic ROIC-adjusted PEG bounds check.
 * Replaces static 1.5x/2.0x sector caps with a ceiling derived from the
 * firm's specific capital efficiency (ROIC/WACC spread).
 * Falls back to ROE proxy, then to static caps when data is unavailable.
 */
function applyPegBoundsCheck(
	result: ScreenerResult,
	actualMultiple: number,
	growthPct: number,
	multipleType: string,
	stock: ScreenerStock
): void {
	if ((result.signal !== 'PASS' && result.signal !== 'WAIT') || growthPct <= 0) return;
	if (!multipleType.includes('P/E')) return;

	const impliedPeg = actualMultiple / growthPct;

	// Parse ROIC and ROE from stock metrics
	const roicPct = parseNumber(stock.metrics?.roic?.replace('%', ''));
	const roePct = parseNumber(stock.metrics?.roe?.replace('%', ''));
	const dynamicCeiling = computeDynamicPegCeiling(roicPct, roePct);

	let pegMax: number;
	if (dynamicCeiling == null) {
		// Static fallback when no capital efficiency data is available
		const group = stock.group ?? '';
		const isHardware = /hardware|semicon|industrial|equipment/i.test(group);
		pegMax = isHardware ? 1.5 : 2;
	} else {
		pegMax = dynamicCeiling;
	}

	if (impliedPeg > pegMax) {
		result.signal = 'FAIL';
		appendNote(
			result,
			`Multiple-expansion trap: PEG ${impliedPeg.toFixed(1)} > ${pegMax.toFixed(1)} ceiling`
		);
	}
}

/**
 * Value floor check: upgrades FAIL → WAIT when analyst upside ≥ 30% or QCS ≥ 8.
 */
function applyValueFloorCheck(
	result: ScreenerResult,
	stock: ScreenerStock,
	rawPrice: number | null | undefined,
	summary: YahooSummary | undefined
): void {
	if (result.signal !== 'FAIL') return;

	let valueFloorReason: string | null = null;

	// Trigger (a): analyst upside ≥ 30%
	const targetMean = summary?.financialData?.targetMeanPrice ?? stock.analystTargets?.mean ?? parseNumber(stock.targetPrice);
	if (targetMean != null && rawPrice != null && rawPrice > 0) {
		const upside = targetMean / rawPrice - 1;
		if (upside >= 0.3) {
			valueFloorReason = `analyst upside ${+(upside * 100).toFixed(1)}%`;
		}
	}

	// Trigger (b): QCS ≥ 8 (elite fundamental quality floor)
	const qcsScore = stock.qcs?.totalScore;
	if (qcsScore != null && qcsScore >= 8) {
		valueFloorReason = valueFloorReason
			? `${valueFloorReason} & elite quality floor (QCS ${qcsScore})`
			: `elite quality floor (QCS ${qcsScore})`;
	}

	if (valueFloorReason !== null) {
		result.signal = 'WAIT';
		appendNote(result, `Upgraded from FAIL: Protected by ${valueFloorReason}`);
	}
}

/**
 * Applies mandatory DEPLOY overrides, REJECT floors, and existential liquidity risk.
 */
function applyDeployRejectOverrides(
	result: ScreenerResult,
	stock: ScreenerStock,
	baseCagr: number | null
): void {
	// Mandatory DEPLOY override & Rejection Floors:
	if (baseCagr == null || result.signal === 'REJECTED') return;

	const stabPass = result.realityChecks?.stabilization?.pass !== false;

	if (baseCagr < 0) {
		result.signal = 'REJECTED';
		appendNote(result, `Absolute REJECT: Base CAGR ${baseCagr}% is negative`);
	} else if (result.signal === 'WAIT' && baseCagr < 15) {
		result.signal = 'REJECTED';
		appendNote(result, `REJECT: Stalled at WAIT with base CAGR ${baseCagr}% < 15%`);
	}
}

function evaluateHyperGrowth(
	stock: ScreenerStock,
	valuationPrice: number | null | undefined,
	summary: YahooSummary | undefined,
	growthPct: number,
	rawPrice: number | null | undefined,
	historicalData: HistoricalData | undefined
): ScreenerResult {
	const branch = detectGrowthBranch(stock, valuationPrice);

	if (branch.engine === 'DISQUALIFIED') {
		return {
			engine: 'DISQUALIFIED',
			signal: 'WAIT',
			note: 'Extreme earnings volatility detected. Awaiting stabilization.'
		};
	}

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

	let actualMultiple = branch.multiple;

	if (branch.multipleType === FORWARD_PE_LABEL) {
		const eps = stock.cagrModel?.ttmEPS;
		if ((eps != null && eps <= 0) || actualMultiple <= 0 || Number.isNaN(actualMultiple)) {
			const fallbackPE = stock.valuation?.trailingPE;
			if (fallbackPE == null || fallbackPE <= 0 || Number.isNaN(fallbackPE)) {
				return {
					engine: branch.engine,
					signal: 'NO_DATA',
					note: 'Missing/negative forward PE and no trailing EPS fallback'
				};
			}
			actualMultiple = fallbackPE;
		}
	}

	const result = computeGrowthScore(
		branch.engine as keyof typeof ENGINE_THRESHOLDS,
		branch.multipleType,
		actualMultiple,
		growthPct,
		cvStock
	);

	applyPegBoundsCheck(result, actualMultiple, growthPct, branch.multipleType, stock);

	// Run reality checks early so we can source revision data from result.realityChecks
	// instead of duplicating the earningsTrend extraction logic.
	applyRealityChecks(result, rawPrice, historicalData, summary, stock);

	const baseCagr = parsePercent(stock.cagrModel?.scenarios?.base);

	const up30d = result.realityChecks?.revisions?.up30d ?? 0;
	const down30d = result.realityChecks?.revisions?.down30d ?? 0;
	const effectiveHurdle = computeEffectiveHurdle(up30d, down30d);

	if (result.signal === 'PASS' && baseCagr != null && baseCagr < effectiveHurdle) {
		result.signal = 'FAIL';
		appendNote(result, `Cheap (${result.score}) but base return ${baseCagr}% misses the ${effectiveHurdle}% hurdle`);
	} else if (result.signal === 'PASS' && baseCagr != null && baseCagr < ETF_HURDLE_RETURN) {
		appendNote(result, `Analyst Lag Override: Hurdle adjusted to ${effectiveHurdle}% due to strong up-revisions`);
	}

	applyValueFloorCheck(result, stock, rawPrice, summary);
	applyDeployRejectOverrides(result, stock, baseCagr);

	// Extreme Structural Risk Penalty
	// (Canonical examples: ZS, AVGO, CRDO — concentrated in 1-2 hyperscaler customers.)
	const bearCaseStr = (stock.bearCase ?? '').toLowerCase();
	if (bearCaseStr.includes('customer concentration') && (result.signal === 'PASS' || result.signal === 'WAIT')) {
		result.signal = 'WAIT';
		appendNote(result, 'Signal capped at WAIT due to customer concentration risk');
	}

	if (branch.engine !== 'fPERG' && branch.engine !== 'tPERG') {
		const fpe = stock.valuation?.forwardPE;
		if (fpe != null && fpe > 0) {
			const fPERGCheck = computeGrowthScore(
				'fPERG',
				FORWARD_PE_LABEL,
				fpe,
				growthPct,
				cvStock
			);
			result.secondaryEngine = 'fPERG';
			result.secondaryScore = fPERGCheck.score;
		}
	}

	if (!dispersion) {
		appendNote(result, 'Used benchmark CV');
	}

	return result;
}

export function computeScreener(
	stock: ScreenerStock,
	summary: YahooSummary | undefined,
	rawPrice: number | null | undefined,
	valuationPrice: number | null | undefined,
	historicalData: HistoricalData | undefined
): ScreenerResult {
	const model = stock.cagrModel;
	const growthPct = parsePercent(model?.epsGrowth);
	if (growthPct == null) return { engine: 'N/A', signal: 'NO_DATA', note: 'Missing growth data' };

	const group = stock.group?.toLowerCase() ?? '';
	if (group.includes('disqualified') || group.includes('pre-profit') || group.includes('binary')) {
		return {
			engine: 'DISQUALIFIED',
			signal: 'REJECTED',
			note: 'Extreme earnings volatility detected. Strategically disqualified.'
		};
	}

	// Only treat as pre-profit (and block evaluation) when ttmEPS is a known
	// negative value. ttmEPS === null means the field is intentionally absent
	// (pre-profit platform like RBRK) — those route to fCFG via AUTO RULE 2
	// in detectGrowthBranch rather than returning early here.
	const isPreProfit = model?.ttmEPS != null && model.ttmEPS <= 0;
	if (isPreProfit) {
		return { engine: 'N/A', signal: 'NO_DATA', note: 'Pre-profit; screener not applicable' };
	}

	const divYieldPct = parsePercent(model?.dividendYield) ?? 0;

	// Route all hyper-growth stocks (growth > threshold) AND low-yield low-growth stocks
	// with a valid forward PE through the PE-growth engine family.
	// totalReturn engine is only appropriate for genuine dividend payers (divYield >= 5%).
	// Alt Assets (FRE/ANI basis) must NEVER route to totalReturn regardless of dividend.
	const basisText = stock.cagrModel?.basis ?? '';
	const isAltAsset =
		stock.group === 'Financials & Alt Assets' || /fre|ani|fee-related|distributable/i.test(basisText);

	if (divYieldPct < 4 || growthPct > 10 || isAltAsset) {
		const valFpe = stock.valuation?.forwardPE;
		const ttmBasis = stock.cagrModel?.ttmEPS;
		const hasPE =
			(valFpe != null && valFpe > 0) ||
			(valuationPrice != null && ttmBasis != null && ttmBasis > 0);

		if (hasPE) {
			return evaluateHyperGrowth(
				stock,
				valuationPrice,
				summary,
				growthPct,
				rawPrice,
				historicalData
			);
		}
	}

	// totalReturn engine: reserved for stocks where dividend yield is the primary
	// return driver (divYield >= 5%) and PE-based routing was skipped or failed.
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

	const debtToEquity = summary?.financialData?.debtToEquity ?? 0;
	const result = computeTotalReturn(growthPct, divYieldPct, forwardPE, debtToEquity, stock);

	applyRealityChecks(result, rawPrice, historicalData, summary, stock);

	return result;
}
