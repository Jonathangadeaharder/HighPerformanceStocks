import type { FindingStock } from '$lib/types/dashboard';

export interface SectorConcentration {
	group: string;
	count: number;
	weightPct: number;
	isConcentrated: boolean;
}

export interface ConcentrationAnalysis {
	sectors: SectorConcentration[];
	topTwoWarning: boolean;
	topTwoPct: number;
}

export interface PortfolioSummary {
	selectedCount: number;
	totalDeployCount: number;
	weightingMode: 'equal' | 'rank';
	weightedAvgBaseCagr: number;
	weightedAvgBearCagr: number;
	weightedAvgBullCagr: number;
	uniqueSectors: number;
	maxSingleWeight: number;
}

export function equalWeight(count: number): number {
	return count > 0 ? 100 / count : 0;
}

export function rankWeightedPositions(stocks: FindingStock[]): Map<string, number> {
	if (stocks.length === 0) return new Map();

	const totalRank = stocks.reduce((sum, s) => sum + (s.deploymentRank ?? 0), 0);
	if (totalRank === 0) {
		const w = equalWeight(stocks.length);
		return new Map(stocks.map((s) => [s.ticker, w]));
	}

	const raw = new Map<string, number>();
	for (const s of stocks) {
		raw.set(s.ticker, ((s.deploymentRank ?? 0) / totalRank) * 100);
	}

	return capAndRedistribute(raw, 15);
}

function capAndRedistribute(weights: Map<string, number>, maxPct: number): Map<string, number> {
	let result = new Map(weights);
	for (let iteration = 0; iteration < 20; iteration++) {
		const capped = new Map<string, number>();
		let excess = 0;
		let uncappedWeight = 0;

		for (const [ticker, w] of result) {
			if (w > maxPct) {
				capped.set(ticker, maxPct);
				excess += w - maxPct;
			} else {
				capped.set(ticker, w);
				uncappedWeight += w;
			}
		}

		if (excess < 0.001) return capped;

		const next = new Map<string, number>();
		for (const [ticker, w] of capped) {
			if (w < maxPct && uncappedWeight > 0) {
				next.set(ticker, w + (w / uncappedWeight) * excess);
			} else {
				next.set(ticker, w);
			}
		}
		result = next;
	}
	return result;
}

export function analyzeSectorConcentration(
	stocks: FindingStock[],
	weights: Map<string, number>
): ConcentrationAnalysis {
	const groupWeights = new Map<string, { count: number; totalWeight: number }>();

	for (const stock of stocks) {
		const group = stock.group ?? 'Unknown';
		const w = weights.get(stock.ticker) ?? 0;
		const existing = groupWeights.get(group) ?? { count: 0, totalWeight: 0 };
		groupWeights.set(group, { count: existing.count + 1, totalWeight: existing.totalWeight + w });
	}

	const sectors: SectorConcentration[] = [...groupWeights.entries()]
		.map(([group, { count, totalWeight }]) => ({
			group,
			count,
			weightPct: +totalWeight.toFixed(1),
			isConcentrated: totalWeight > 30
		}))
		.sort((a, b) => b.weightPct - a.weightPct);

	const topTwoPct = sectors.slice(0, 2).reduce((sum, s) => sum + s.weightPct, 0);

	return { sectors, topTwoWarning: topTwoPct > 60, topTwoPct: +topTwoPct.toFixed(1) };
}

export function computePortfolioSummary(
	selected: FindingStock[],
	totalDeployCount: number,
	weights: Map<string, number>,
	weightingMode: 'equal' | 'rank'
): PortfolioSummary {
	let weightedBaseCagr = 0;
	let weightedBearCagr = 0;
	let weightedBullCagr = 0;
	let totalWeight = 0;

	for (const s of selected) {
		const w = weights.get(s.ticker) ?? 0;
		weightedBaseCagr += (s.baseCagr ?? 0) * w;
		weightedBearCagr += (s.bearCagr ?? 0) * w;
		weightedBullCagr += (s.bullCagr ?? 0) * w;
		totalWeight += w;
	}

	const divisor = totalWeight > 0 ? totalWeight : 1;
	const uniqueGroups = new Set(selected.map((s) => s.group ?? 'Unknown')).size;
	const maxWeight = Math.max(0, ...weights.values());

	return {
		selectedCount: selected.length,
		totalDeployCount,
		weightingMode,
		weightedAvgBaseCagr: +(weightedBaseCagr / divisor).toFixed(1),
		weightedAvgBearCagr: +(weightedBearCagr / divisor).toFixed(1),
		weightedAvgBullCagr: +(weightedBullCagr / divisor).toFixed(1),
		uniqueSectors: uniqueGroups,
		maxSingleWeight: +maxWeight.toFixed(1)
	};
}
