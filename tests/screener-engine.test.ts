import { describe, expect, it } from 'vitest';
import {
	computeEffectiveGrowth,
	computeDispersionMultiplier,
	computeLeveragePenalty,
	computeLeveragePenaltyICR,
	computeDynamicPegCeiling
} from '../src/lib/domain/screener/engine';

// ────────────────────────────────────────────────────────
// Component 1: Hyper-Growth Exponential Decay
// ────────────────────────────────────────────────────────
describe('computeEffectiveGrowth (exponential decay)', () => {
	it('passes through growth ≤ 30% unchanged', () => {
		expect(computeEffectiveGrowth(10)).toBe(10);
		expect(computeEffectiveGrowth(25)).toBe(25);
		expect(computeEffectiveGrowth(30)).toBe(30);
	});

	it('is exactly 30 at the threshold boundary', () => {
		expect(computeEffectiveGrowth(30)).toBe(30);
	});

	it('compresses growth above 30% asymptotically', () => {
		const g35 = computeEffectiveGrowth(35);
		const g40 = computeEffectiveGrowth(40);
		const g50 = computeEffectiveGrowth(50);
		const g60 = computeEffectiveGrowth(60);
		const g80 = computeEffectiveGrowth(80);

		// Monotonically increasing
		expect(g35).toBeGreaterThan(30);
		expect(g40).toBeGreaterThan(g35);
		expect(g50).toBeGreaterThan(g40);
		expect(g60).toBeGreaterThan(g50);
		expect(g80).toBeGreaterThan(g60);

		// But all clamped below 40 (30 + C_max of 10)
		expect(g80).toBeLessThan(40);
	});

	it('asymptotically approaches but never reaches 40', () => {
		const g100 = computeEffectiveGrowth(100);
		const g200 = computeEffectiveGrowth(200);

		expect(g100).toBeLessThan(40);
		expect(g200).toBeLessThan(40);
		// At g=100, excess=70, should be very close to ceiling
		expect(g100).toBeGreaterThan(39.9);
	});

	it('is milder than linear at modest excess (32%)', () => {
		const exponential = computeEffectiveGrowth(32);
		const linear = 30 + (32 - 30) * 0.5; // old formula → 31
		expect(exponential).toBeGreaterThan(linear);
	});

	it('is more punitive than linear at extreme excess (60%)', () => {
		const exponential = computeEffectiveGrowth(60);
		const linear = 30 + (60 - 30) * 0.5; // old formula → 45
		expect(exponential).toBeLessThan(linear);
	});

	it('handles zero and negative growth', () => {
		expect(computeEffectiveGrowth(0)).toBe(0);
		expect(computeEffectiveGrowth(-5)).toBe(-5);
	});
});

// ────────────────────────────────────────────────────────
// Component 2: Analyst Dispersion Convex Penalty
// ────────────────────────────────────────────────────────
describe('computeDispersionMultiplier (convex power-law)', () => {
	it('returns 1.0 for CV at or below safe threshold (0.10)', () => {
		expect(computeDispersionMultiplier(0.05)).toBe(1);
		expect(computeDispersionMultiplier(0.08)).toBe(1);
		expect(computeDispersionMultiplier(0.10)).toBe(1);
	});

	it('applies quadratic scaling above the threshold', () => {
		const cv015 = computeDispersionMultiplier(0.15);
		const cv020 = computeDispersionMultiplier(0.20);
		const cv030 = computeDispersionMultiplier(0.30);

		// CV=0.15: excess=0.05, penalty = 15 * 0.05^2 = 0.0375 → mult = 1.0375
		expect(cv015).toBeCloseTo(1.0375, 3);
		// CV=0.20: excess=0.10, penalty = 15 * 0.10^2 = 0.15 → mult = 1.15
		expect(cv020).toBeCloseTo(1.15, 3);
		// CV=0.30: excess=0.20, penalty = 15 * 0.20^2 = 0.60 → mult = 1.60
		expect(cv030).toBeCloseTo(1.60, 3);
	});

	it('severely penalizes top-quintile dispersion (CV≥0.40)', () => {
		const cv040 = computeDispersionMultiplier(0.40);
		// CV=0.40: excess=0.30, penalty = 15 * 0.30^2 = 1.35 → mult = 2.35
		expect(cv040).toBeCloseTo(2.35, 3);
		expect(cv040).toBeGreaterThan(2.0);
	});

	it('is always ≥ 1.0', () => {
		expect(computeDispersionMultiplier(0)).toBeGreaterThanOrEqual(1);
		expect(computeDispersionMultiplier(-0.1)).toBeGreaterThanOrEqual(1);
	});

	it('penalty growth rate accelerates (convexity)', () => {
		const delta1 = computeDispersionMultiplier(0.20) - computeDispersionMultiplier(0.15);
		const delta2 = computeDispersionMultiplier(0.25) - computeDispersionMultiplier(0.20);
		// Convex: the second delta should be larger than the first
		expect(delta2).toBeGreaterThan(delta1);
	});
});

// ────────────────────────────────────────────────────────
// Component 3: ROIC-Adjusted Dynamic PEG Ceiling
// ────────────────────────────────────────────────────────
describe('computeDynamicPegCeiling (ROIC-adjusted)', () => {
	it('returns null when both ROIC and ROE are null', () => {
		expect(computeDynamicPegCeiling(null, null)).toBeNull();
	});

	it('returns null when capital return is zero or negative', () => {
		expect(computeDynamicPegCeiling(0, null)).toBeNull();
		expect(computeDynamicPegCeiling(-10, null)).toBeNull();
		expect(computeDynamicPegCeiling(null, 0)).toBeNull();
	});

	it('returns PEG_BASE (1.25) when ROIC equals WACC (9%)', () => {
		const ceiling = computeDynamicPegCeiling(9, null);
		expect(ceiling).toBeCloseTo(1.25, 2);
	});

	it('returns PEG_BASE when ROIC is below WACC', () => {
		const ceiling = computeDynamicPegCeiling(5, null);
		// ratio = max(1, 5/9) = 1; ln(1) = 0 → 1.25
		expect(ceiling).toBeCloseTo(1.25, 2);
	});

	it('scales with ROIC/WACC spread', () => {
		const atWacc = computeDynamicPegCeiling(9, null)!;
		const double = computeDynamicPegCeiling(18, null)!;
		const quadruple = computeDynamicPegCeiling(36, null)!;

		expect(double).toBeGreaterThan(atWacc);
		expect(quadruple).toBeGreaterThan(double);
	});

	it('prefers ROIC over ROE when both are available', () => {
		// Different ROIC and ROE should produce different results
		const withRoic = computeDynamicPegCeiling(50, 25)!;
		const withRoe = computeDynamicPegCeiling(null, 25)!;
		// ROIC=50 gives higher ratio than ROE=25, so ceiling should be higher
		expect(withRoic).toBeGreaterThan(withRoe);
	});

	it('falls back to ROE when ROIC is null', () => {
		const ceiling = computeDynamicPegCeiling(null, 25);
		// ratio = max(1, 25/9) = 2.78; ln(2.78) ≈ 1.02 → 1.25 + 0.65*1.02 ≈ 1.91
		expect(ceiling).toBeGreaterThan(1.25);
		expect(ceiling).toBeLessThan(3.0);
	});

	it('caps at PEG_MAX_CAP (3.0) for extreme ROIC spreads', () => {
		const ceiling = computeDynamicPegCeiling(150, null);
		expect(ceiling).toBe(3.0);
	});

	it('produces reasonable mid-range values', () => {
		// ROIC=20%: ratio = 20/9 ≈ 2.22, ln(2.22) ≈ 0.80 → 1.25 + 0.65*0.80 ≈ 1.77
		const ceiling = computeDynamicPegCeiling(20, null)!;
		expect(ceiling).toBeCloseTo(1.77, 1);
	});
});

// ────────────────────────────────────────────────────────
// Component 4: Continuous Leverage Sigmoid
// ────────────────────────────────────────────────────────
describe('computeLeveragePenalty (logistic sigmoid)', () => {
	it('imposes near-zero penalty for low-debt firms', () => {
		const p50 = computeLeveragePenalty(50);
		expect(p50).toBeLessThan(0.02);
	});

	it('is continuous — no cliff between 149% and 151%', () => {
		const p149 = computeLeveragePenalty(149);
		const p151 = computeLeveragePenalty(151);
		const diff = Math.abs(p151 - p149);
		// The difference should be tiny (< 0.5%)
		expect(diff).toBeLessThan(0.005);
	});

	it('reaches approximately 50% of P_max at the inflection point (D/E=200)', () => {
		const pMid = computeLeveragePenalty(200);
		// At mid-point of logistic, penalty = P_max / 2
		expect(pMid).toBeCloseTo(0.175, 2);
	});

	it('converges to P_max for extreme leverage', () => {
		const p500 = computeLeveragePenalty(500);
		expect(p500).toBeGreaterThan(0.33);
		expect(p500).toBeLessThanOrEqual(0.35);
	});

	it('is strictly monotonically increasing', () => {
		const values = [0, 50, 100, 150, 200, 300, 400, 500];
		for (let i = 1; i < values.length; i++) {
			expect(computeLeveragePenalty(values[i]!)).toBeGreaterThan(
				computeLeveragePenalty(values[i - 1]!)
			);
		}
	});

	it('is bounded in [0, 0.35]', () => {
		expect(computeLeveragePenalty(0)).toBeGreaterThanOrEqual(0);
		expect(computeLeveragePenalty(1000)).toBeLessThanOrEqual(0.35);
	});

	it('penalty at D/E=150 is significantly less than old 30% cliff', () => {
		const p150 = computeLeveragePenalty(150);
		expect(p150).toBeLessThan(0.15);
	});
});

// ────────────────────────────────────────────────────────
// Component 4 Phase 2: ICR-Based Leverage Sigmoid
// ────────────────────────────────────────────────────────
describe('computeLeveragePenaltyICR (interest coverage sigmoid)', () => {
	it('imposes near-maximum penalty for very low coverage (ICR < 1x)', () => {
		const p05 = computeLeveragePenaltyICR(0.5);
		expect(p05).toBeGreaterThan(0.30);
		expect(p05).toBeLessThanOrEqual(0.35);
	});

	it('imposes approximately P_max/2 at the inflection point (ICR=3x)', () => {
		const pMid = computeLeveragePenaltyICR(3);
		expect(pMid).toBeCloseTo(0.175, 2);
	});

	it('imposes near-zero penalty for high coverage (ICR > 8x)', () => {
		const p10 = computeLeveragePenaltyICR(10);
		expect(p10).toBeLessThan(0.01);
	});

	it('is strictly monotonically decreasing (inverse of D/E sigmoid)', () => {
		const values = [0.5, 1, 2, 3, 5, 8, 15, 30];
		for (let i = 1; i < values.length; i++) {
			expect(computeLeveragePenaltyICR(values[i]!)).toBeLessThan(
				computeLeveragePenaltyICR(values[i - 1]!)
			);
		}
	});

	it('is bounded in [0, 0.35]', () => {
		expect(computeLeveragePenaltyICR(0.1)).toBeLessThanOrEqual(0.35);
		expect(computeLeveragePenaltyICR(100)).toBeGreaterThanOrEqual(0);
	});

	it('AAPL-like ICR (30.7x) gets negligible penalty', () => {
		const p = computeLeveragePenaltyICR(30.7);
		expect(p).toBeLessThan(0.001);
	});

	it('distressed firm (ICR 1.5x) gets severe penalty', () => {
		const p = computeLeveragePenaltyICR(1.5);
		expect(p).toBeGreaterThan(0.25);
	});
});


// ────────────────────────────────────────────────────────
// Component 5: Beta-Adaptive Momentum (threshold math)
// ────────────────────────────────────────────────────────
describe('beta-adaptive momentum thresholds', () => {
	const STAB_6M_BASE = -10;
	const STAB_1M_BASE = -3;
	const BETA_MIN_CLAMP = 0.5;
	const BETA_MAX_CLAMP = 2.0;

	function adjustedThresholds(beta: number): { t6m: number; t1m: number } {
		const clamped = Math.max(BETA_MIN_CLAMP, Math.min(BETA_MAX_CLAMP, beta));
		return {
			t6m: STAB_6M_BASE * clamped,
			t1m: STAB_1M_BASE * clamped
		};
	}

	it('produces tighter thresholds for low-beta stocks', () => {
		const { t6m, t1m } = adjustedThresholds(0.5);
		expect(t6m).toBe(-5.0);
		expect(t1m).toBe(-1.5);
	});

	it('matches baseline for beta=1.0', () => {
		const { t6m, t1m } = adjustedThresholds(1.0);
		expect(t6m).toBe(-10.0);
		expect(t1m).toBe(-3.0);
	});

	it('produces wider thresholds for high-beta stocks', () => {
		const { t6m, t1m } = adjustedThresholds(1.5);
		expect(t6m).toBe(-15.0);
		expect(t1m).toBe(-4.5);
	});

	it('clamps at BETA_MIN_CLAMP (0.5)', () => {
		const { t6m } = adjustedThresholds(0.2);
		expect(t6m).toBe(-5.0); // clamped to 0.5
	});

	it('clamps at BETA_MAX_CLAMP (2.0)', () => {
		const { t6m } = adjustedThresholds(3.0);
		expect(t6m).toBe(-20.0); // clamped to 2.0
	});

	it('a -10% drop on beta=1.5 does NOT trigger (within range)', () => {
		const { t6m } = adjustedThresholds(1.5);
		const drop = -10;
		// -10 is NOT less than -15, so shouldn't trigger
		expect(drop < t6m).toBe(false);
	});

	it('a -10% drop on beta=0.6 DOES trigger (exceeds range)', () => {
		const { t6m } = adjustedThresholds(0.6);
		const drop = -10;
		// -10 IS less than -6, so should trigger
		expect(drop < t6m).toBe(true);
	});
});

// ────────────────────────────────────────────────────────
// Phase 2: Full VAMS (Volatility-Adjusted Momentum Score)
// ────────────────────────────────────────────────────────
describe('VAMS (Volatility-Adjusted Momentum Score)', () => {
	const VAMS_REJECT_THRESHOLD = -1.25;

	/**
	 * Compute a blended multi-horizon VAMS score.
	 * Replicates the engine's internal VAMS computation for testability.
	 */
	function computeVAMS(
		return1m: number,
		return3m: number,
		return6m: number,
		exAnteVol: number
	): number {
		const vams1 = return1m / (exAnteVol * Math.sqrt(1 / 12));
		const vams3 = return3m / (exAnteVol * Math.sqrt(3 / 12));
		const vams6 = return6m / (exAnteVol * Math.sqrt(6 / 12));
		return 0.5 * vams1 + 0.3 * vams3 + 0.2 * vams6;
	}

	it('returns near-zero for flat returns', () => {
		const score = computeVAMS(0, 0, 0, 30);
		expect(score).toBe(0);
	});

	it('is positive for uniformly positive returns', () => {
		const score = computeVAMS(5, 10, 15, 30);
		expect(score).toBeGreaterThan(0);
	});

	it('is negative for uniformly negative returns', () => {
		const score = computeVAMS(-5, -10, -15, 30);
		expect(score).toBeLessThan(0);
	});

	it('a moderate drop on a high-vol stock stays above rejection threshold', () => {
		// -8% 1m, -12% 3m, -15% 6m on a 50% vol stock → noise, not structural
		const score = computeVAMS(-8, -12, -15, 50);
		expect(score).toBeGreaterThan(VAMS_REJECT_THRESHOLD);
	});

	it('a moderate drop on a low-vol stock breaches rejection threshold', () => {
		// Same returns on a 15% vol stock → structural alarm
		const score = computeVAMS(-8, -12, -15, 15);
		expect(score).toBeLessThan(VAMS_REJECT_THRESHOLD);
	});

	it('differentiates "falling knife" from "mean-reversion opportunity"', () => {
		// Falling knife: consistent negative across all horizons
		const fallingKnife = computeVAMS(-10, -20, -30, 25);
		// Mean reversion: recent uptick despite earlier drawdown
		const meanReversion = computeVAMS(3, -5, -20, 25);

		expect(fallingKnife).toBeLessThan(VAMS_REJECT_THRESHOLD);
		expect(meanReversion).toBeGreaterThan(VAMS_REJECT_THRESHOLD);
	});

	it('weights short-term (1m) most heavily at 50%', () => {
		// All returns are the same, but 1m has 50% weight
		// A positive short-term should pull the score up significantly
		const posShort = computeVAMS(10, -10, -10, 30);
		const negShort = computeVAMS(-10, 10, 10, 30);

		// Short-term positive should dominate → higher score
		expect(posShort).toBeGreaterThan(negShort);
	});

	it('scales inversely with volatility (vol normalization)', () => {
		const lowVol = computeVAMS(-10, -15, -20, 15);
		const highVol = computeVAMS(-10, -15, -20, 45);

		// Same absolute returns → low vol gets much worse z-score
		expect(lowVol).toBeLessThan(highVol);
		expect(Math.abs(lowVol)).toBeGreaterThan(Math.abs(highVol) * 2);
	});
});

// ────────────────────────────────────────────────────────
// computeScreener: threshold & WAIT-band boundaries
// ────────────────────────────────────────────────────────
import { computeScreener } from '../src/lib/domain/screener/engine';
import type { ScreenerStock } from '../src/lib/domain/screener/types';

/** Minimal stock that routes to fPERG (forward P/E engine). */
function makePERGStock(forwardPE: number, epsGrowth: string): ScreenerStock {
	return {
		cagrModel: { epsGrowth, ttmEPS: 5 },
		valuation: { forwardPE }
	};
}

describe('computeScreener — fPERG threshold and WAIT-band', () => {
	// fPERG threshold = 1.0; score = forwardPE / effectiveGrowth
	// At 25% growth effectiveGrowth=25. score=1.0 → exactly at threshold → PASS.
	it('returns PASS when score equals the fPERG threshold (1.0)', () => {
		const stock = makePERGStock(25, '25%');
		const result = computeScreener(stock, undefined, 100, 100, undefined);
		expect(result.engine).toBe('fPERG');
		expect(result.signal).toBe('PASS');
	});

	// score slightly above 1.0 but inside the WAIT band (threshold * 1.2 = 1.2)
	it('returns WAIT when score is within the 20% borderline band above fPERG threshold', () => {
		// score = 28 / 25 = 1.12 — inside [1.0, 1.2] WAIT band
		const stock = makePERGStock(28, '25%');
		const result = computeScreener(stock, undefined, 100, 100, undefined);
		expect(result.engine).toBe('fPERG');
		expect(result.signal).toBe('WAIT');
	});

	// score above waitThreshold (1.2) → FAIL
	it('returns FAIL when score exceeds the fPERG wait-band upper bound', () => {
		// score = 40 / 25 = 1.6 — well above 1.2 waitThreshold
		const stock = makePERGStock(40, '25%');
		const result = computeScreener(stock, undefined, 100, 100, undefined);
		expect(result.engine).toBe('fPERG');
		expect(result.signal).toBe('FAIL');
	});

	it('returns NO_DATA when growth is missing', () => {
		const stock: ScreenerStock = { cagrModel: {}, valuation: { forwardPE: 20 } };
		const result = computeScreener(stock, undefined, 100, 100, undefined);
		expect(result.signal).toBe('NO_DATA');
	});

	// Regression: the hardcoded bearCase string-match that capped
	// "customer concentration" stocks at WAIT was removed in
	// refactor/remove-customer-concentration-filter. This test asserts it
	// is never reintroduced — a clear PASS stock must remain PASS regardless
	// of what prose appears in its bearCase narrative.
	it('does NOT cap a clean fPERG PASS to WAIT when bearCase mentions "customer concentration"', () => {
		const stock: ScreenerStock = {
			cagrModel: { epsGrowth: '57%', ttmEPS: 5 },
			valuation: { forwardPE: 17.6 },
			bearCase: 'Heavy reliance on a few massive hyperscaler clients creates customer concentration risk.'
		};
		const result = computeScreener(stock, undefined, 100, 100, undefined);
		expect(result.engine).toBe('fPERG');
		expect(result.signal).toBe('PASS');
	});
});
