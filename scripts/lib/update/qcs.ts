/**
 * Computes the Quantitative Conviction Score (QCS).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function computeQCS(summary: any, cvStock = 0.08) {
	if (!summary) return;

	// 1. Forecast Credibility Score (Standardized Surprise)
	let totalSurprise = 0;
	let validQuarters = 0;
	const history = summary.earningsHistory?.history || [];
	for (const q of history) {
		if (typeof q.surprisePercent === 'number') {
			totalSurprise += q.surprisePercent;
			validQuarters++;
		}
	}

	let avgSurprise = 0;
	let earningsScore = 0;
	if (validQuarters > 0) {
		avgSurprise = totalSurprise / validQuarters;
		const cvBenchmark = 0.08;
		const safeCvStock = Math.max(0.01, cvStock);

		// Formula: (Avg Surprise * 50) * (CV Benchmark / CV Stock)
		earningsScore = avgSurprise * 50 * (cvBenchmark / safeCvStock);
		earningsScore = +Math.max(-5, Math.min(5, earningsScore)).toFixed(2);
	}

	const netInsiderShares = summary.netSharePurchaseActivity?.netInfoShares || 0;
	let instDelta = 0;
	const instList = summary.institutionOwnership?.ownershipList || [];
	for (const inst of instList) {
		if (inst.pctChange && inst.pctHeld) {
			instDelta += inst.pctChange * inst.pctHeld;
		}
	}

	let flowScore = 0;
	let instFlowTrend = 'neutral';
	if (instDelta > 0.005) instFlowTrend = 'positive';
	else if (instDelta < -0.005) instFlowTrend = 'negative';

	if (netInsiderShares > 0 && instFlowTrend === 'positive') {
		flowScore = 5;
	} else if (instFlowTrend === 'positive') {
		flowScore = 2.5;
	} else if (netInsiderShares < -1000 && instFlowTrend === 'negative') {
		flowScore = -5;
	}

	let upRevisions = 0;
	let downRevisions = 0;
	let totalAnalysts = 1;
	const trend =
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		summary.earningsTrend?.trend?.find((t: any) => t.period === '0y') ||
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		summary.earningsTrend?.trend?.find((t: any) => t.period === '+1y');

	if (trend) {
		upRevisions = trend.epsRevisions?.upLast30days || 0;
		downRevisions = trend.epsRevisions?.downLast30days || 0;
		totalAnalysts =
			trend.earningsEstimate?.numberOfAnalysts || Math.max(1, upRevisions + downRevisions);
	}

	const revisionsScore = +(((upRevisions - downRevisions) / totalAnalysts) * 5).toFixed(2);

	// Cap total score to +/- 15
	let totalScore = +(earningsScore + flowScore + revisionsScore).toFixed(2);
	totalScore = Math.max(-15, Math.min(15, totalScore));

	return {
		earningsScore,
		flowScore,
		revisionsScore,
		totalScore,
		raw: {
			avgSurprisePct: validQuarters > 0 ? +((totalSurprise / validQuarters) * 100).toFixed(2) : 0,
			netInsiderShares,
			instFlowTrend,
			upRevisions,
			downRevisions,
			totalAnalysts
		}
	};
}
