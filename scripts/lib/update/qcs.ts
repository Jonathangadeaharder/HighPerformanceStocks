function computeEarningsScore(summary: any, cvStock: number) {
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
		earningsScore = avgSurprise * 50 * (cvBenchmark / safeCvStock);
		earningsScore = +Math.max(-5, Math.min(5, earningsScore)).toFixed(2);
	}
	return {
		earningsScore,
		avgSurprisePct: validQuarters > 0 ? +((totalSurprise / validQuarters) * 100).toFixed(2) : 0,
		validQuarters
	};
}

function computeFlowScore(summary: any) {
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
	return { flowScore, netInsiderShares, instFlowTrend };
}

function computeRevisionsScore(summary: any) {
	let upRevisions = 0;
	let downRevisions = 0;
	let totalAnalysts = 1;
	const trend =
		summary.earningsTrend?.trend?.find((t: any) => t.period === '0y') ||
		summary.earningsTrend?.trend?.find((t: any) => t.period === '+1y');

	if (trend) {
		upRevisions = trend.epsRevisions?.upLast30days || 0;
		downRevisions = trend.epsRevisions?.downLast30days || 0;
		totalAnalysts =
			trend.earningsEstimate?.numberOfAnalysts || Math.max(1, upRevisions + downRevisions);
	}
	const revisionsScore = +(((upRevisions - downRevisions) / totalAnalysts) * 5).toFixed(2);
	return { revisionsScore, upRevisions, downRevisions, totalAnalysts };
}

/**
 * Computes the Quantitative Conviction Score (QCS).
 */
export function computeQCS(summary: any, cvStock = 0.08) {
	if (!summary) return;

	const { earningsScore, avgSurprisePct, validQuarters } = computeEarningsScore(summary, cvStock);
	const { flowScore, netInsiderShares, instFlowTrend } = computeFlowScore(summary);
	const { revisionsScore, upRevisions, downRevisions, totalAnalysts } =
		computeRevisionsScore(summary);

	let totalScore = +(earningsScore + flowScore + revisionsScore).toFixed(2);
	totalScore = Math.max(-15, Math.min(15, totalScore));

	return {
		earningsScore,
		flowScore,
		revisionsScore,
		totalScore,
		raw: {
			avgSurprisePct,
			netInsiderShares,
			instFlowTrend,
			upRevisions,
			downRevisions,
			totalAnalysts
		}
	};
}
