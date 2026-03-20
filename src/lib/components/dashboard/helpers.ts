import type { FindingStock, ScenarioKey, WorldVolSignal } from '$lib/types/dashboard';

function parsePercent(value: string | null | undefined): number | null {
	if (!value) return null;
	const match = value.match(/-?\d+(?:\.\d+)?/);
	return match ? Number.parseFloat(match[0]) : null;
}

export function qualityColor(metricName: string, rawValue: string | null | undefined): string {
	if (!rawValue) return '#3f3f46';
	if (metricName === 'netDebtEbitda') {
		if (/net cash/i.test(rawValue)) return '#22c55e';
		const v = parsePercent(rawValue);
		if (v == null) return '#3f3f46';
		if (v < 2) return '#22c55e';
		if (v < 3) return '#facc15';
		return '#f87171';
	}
	const v = parsePercent(rawValue);
	if (v == null) return '#3f3f46';
	if (metricName === 'roe') return v >= 15 ? '#22c55e' : v >= 10 ? '#facc15' : '#71717a';
	if (metricName === 'fcfYield') return v >= 3 ? '#22c55e' : v >= 1 ? '#facc15' : '#71717a';
	if (metricName === 'ruleOf40') return v >= 40 ? '#22c55e' : v >= 20 ? '#facc15' : '#71717a';
	return '#71717a';
}

export function sensitivityColor(spread: number | null | undefined): string {
	if (spread == null) return '#71717a';
	if (spread <= 40) return '#4ade80';
	if (spread <= 70) return '#facc15';
	return '#f87171';
}

export const scenarioKeys: ScenarioKey[] = ['bear', 'base', 'bull'];

export function scoreColor(score: number | null | undefined): string {
	if (score == null) return '#71717a';
	if (score <= 0.5) return '#22c55e';
	if (score <= 0.75) return '#4ade80';
	return '#a3e635';
}

export function upsideColor(value: number | null | undefined): string {
	if (value == null) return '#52525b';
	if (value < 0) return '#f87171';
	if (value < 15) return '#facc15';
	return '#4ade80';
}

export function isGrowthEngine(stock: FindingStock): boolean {
	return stock.screener?.engine !== 'totalReturn' && stock.screener?.engine !== 'N/A';
}

export function scoreLabel(stock: FindingStock): string {
	return `${stock.screener?.score ?? 'N/A'} score`;
}

export function screenerLabel(stock: FindingStock): string {
	return stock.screener?.inputs?.multipleType ?? stock.screener?.engine ?? 'N/A';
}

export function detailLabel(stock: FindingStock): string {
	if (isGrowthEngine(stock)) {
		return `${stock.screener?.inputs?.growth ?? 'N/A'}% growth · ${stock.screener?.inputs?.multiple ?? 'N/A'}× ${screenerLabel(stock)}`;
	}

	const dividendYield = stock.screener?.inputs?.dividendYield ?? 'N/A';
	const growth = stock.screener?.inputs?.growth ?? 'N/A';
	const debtPenalty = stock.screener?.inputs?.debtPenalty ? ' · 30% debt penalty' : '';
	return `${dividendYield}% yield + ${growth}% growth · Total Return${debtPenalty}`;
}

export function stabilizationReturn(value: number | null | undefined = 0): string {
	return `${(value ?? 0) > 0 ? '+' : ''}${value ?? 0}%`;
}

export function returnColor(value: number | null | undefined): string {
	if ((value ?? 0) >= 0) return '#4ade80';
	if ((value ?? 0) >= -10) return '#facc15';
	return '#f87171';
}

export function deploymentReason(stock: FindingStock): string {
	return stock.deployment?.reason ?? 'No deployment rationale available.';
}

export function screenerNote(stock: FindingStock): string {
	return stock.screener?.note ?? 'No screener note available.';
}

export function revisionsSummary(stock: FindingStock): string {
	const up30d = stock.screener?.realityChecks?.revisions?.up30d ?? 0;
	const down30d = stock.screener?.realityChecks?.revisions?.down30d ?? 0;
	return `✓ ${up30d}↑ ${down30d}↓ revisions`;
}

export function scenarioValue(stock: FindingStock, scenario: ScenarioKey): string | null {
	return stock.cagrModel?.scenarios?.[scenario] ?? null;
}

export function volToneClass(signal: WorldVolSignal): string {
	return signal.available ? signal.tone : 'unavailable';
}

export function componentWeight(weight: number | null | undefined): string | null {
	return weight == null ? null : `${Math.round(weight * 100)}%`;
}

export function watchSignalClass(stock: FindingStock): string {
	return stock.deployment?.status ? stock.deployment.status.toLowerCase() : 'no_data';
}

export function intrinsicValueLabel(stock: FindingStock): string | null {
	const iv = stock.intrinsicValue;
	if (!iv?.dcf) return null;
	const dcfStr = iv.dcf >= 100 ? `$${Math.round(iv.dcf)}` : `$${iv.dcf.toFixed(1)}`;
	if (iv.discount == null) return `IV ${dcfStr}`;
	const sign = iv.discount >= 0 ? '+' : '';
	return `IV ${dcfStr} (${sign}${iv.discount}%)`;
}

export function intrinsicValueColor(stock: FindingStock): string {
	const discount = stock.intrinsicValue?.discount;
	if (discount == null) return '#71717a';
	if (discount >= 20) return '#22c55e';
	if (discount >= 0) return '#4ade80';
	if (discount >= -20) return '#facc15';
	return '#f87171';
}
