import type { DeploymentInfo, FindingStock } from '$lib/types/dashboard';

export const ETF_HURDLE_RETURN = 15;
export const BEAR_FLOOR_RETURN = 0;
export const VALUE_FLOOR_BEAR_RETURN = 5;
export const VALUE_FLOOR_BASE_RETURN = 25;
export const VALUE_FLOOR_UPSIDE = 25;
export const VALUE_FLOOR_MAX_SCORE = 0.65;

/**
 * Determines if a stock likely has a "value floor" established.
 * Value floors are based on strong fundamentals, deep upside, and supportive revisions
 * while the price is near a 3-month low.
 */
export function hasLikelyValueFloor(stock: FindingStock): boolean {
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

/**
 * Rules for stocks that PASS the primary screener.
 */
export function deploymentForPass(stock: FindingStock): DeploymentInfo {
	const base = stock.baseCagr ?? -999;
	const bear = stock.bearCagr ?? -999;
	const basePass = base >= ETF_HURDLE_RETURN;
	const stabPass = stock.screener?.realityChecks?.stabilization?.pass ?? false;
	const bearPass = bear >= BEAR_FLOOR_RETURN;

	if (basePass && stabPass && bearPass) {
		return { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' };
	}

	if (!stabPass) {
		return {
			status: 'WAIT',
			reason: 'Falling knife (stabilization failed) – likely lagging analyst targets.'
		};
	}

	if (!basePass || !bearPass) {
		return {
			status: 'FAIL',
			reason: `Forward return (Base ${base}%, Bear ${bear}%) misses hurdle.`
		};
	}

	return { status: 'FAIL', reason: 'Needs more conviction before deployment.' };
}

/**
 * Rules for stocks in WAIT state.
 */
export function deploymentForWait(stock: FindingStock): DeploymentInfo {
	return hasLikelyValueFloor(stock)
		? {
				status: 'DEPLOY',
				reason:
					'Likely value floor: strong bear/base returns, deep upside, supportive revisions, and price already near the 3-month low.'
			}
		: { status: 'WAIT', reason: stock.screener?.note ?? 'Cheap, but still stabilizing.' };
}

/**
 * Rules for stocks that FAIL the primary screener.
 */
export function deploymentForFail(stock: FindingStock): DeploymentInfo {
	const score = stock.screener?.score;
	const note = stock.screener?.note;
	const base = stock.baseCagr ?? -999;

	if ((score ?? 0) >= 1.5 && base >= 20) {
		return {
			status: 'OVERPRICED',
			reason: note ?? `Extreme valuation (Score ${score}). Wait for compression.`
		};
	}

	if (score != null && score > 1) {
		return {
			status: 'FAIL',
			reason: note ?? `Valuation score ${score} is above the 1.0 buy threshold (lower is better).`
		};
	}

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

/**
 * Assigns the final deployment status and reason to a stock.
 */
export function assignDeployment(stock: FindingStock): void {
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
		case 'DEPLOY':
		case 'FLAG FOR MANUAL REVIEW': {
			stock.deployment = {
				status: signal,
				reason: stock.screener?.note ?? `Screener hit threshold.`
			};
			break;
		}
		default: {
			const _exhaustiveCheck: never = signal;
			stock.deployment = {
				status: 'NO_DATA',
				reason: `Unknown signal: ${String(_exhaustiveCheck)}`
			};
		}
	}

	if (stock.cyclical && stock.deployment.status !== 'NO_DATA') {
		stock.deployment.reason += ' (CYCLICAL EPS)';
	}
}
