import type { AvailableWorldVolSignal, VolComponent } from '$lib/types/dashboard';

export const WORLD_VOL_PRIMARY_MAX_AGE_DAYS = 7;
export const WORLD_VOL_WEIGHTS = {
	vix: 0.7,
	vstoxx: 0.3
} as const;

export interface WeightedValue {
	value: number;
	weight: number;
}

export function weightedAverage(values: WeightedValue[]): number | null {
	if (values.length === 0) return null;

	const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
	if (totalWeight === 0) return null;

	return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

export function classifyWorldVol(
	impliedVol: number
): Pick<AvailableWorldVolSignal, 'action' | 'band' | 'tone'> {
	if (impliedVol < 15) {
		return {
			action: 'Buy 2x daily leverage',
			band: '< 15',
			tone: 'buy'
		};
	}

	if (impliedVol <= 25) {
		return {
			action: 'Hold / do not add 2x',
			band: '15-25',
			tone: 'hold'
		};
	}

	return {
		action: 'Sell / reduce 2x',
		band: '> 25',
		tone: 'sell'
	};
}

export function buildCompositeWorldVolSignal(components: VolComponent[]): AvailableWorldVolSignal | null {
	const weightedValues = components.flatMap((component) => {
		return component.value === null || !component.fresh
			? []
			: [{ value: component.value, weight: component.weight }];
	});
	const impliedVol = weightedAverage(weightedValues);
	if (impliedVol === null) return null;

	const classification = classifyWorldVol(impliedVol);

	const freshCount = weightedValues.length;
	const sourceLabel =
		freshCount === components.length
			? '70% VIX + 30% VSTOXX'
			: components
					.filter((c) => c.fresh)
					.map((c) => `100% ${c.label}`)
					.join(', ');

	return {
		available: true,
		method: 'composite',
		source: sourceLabel,
		impliedVol: +impliedVol.toFixed(1),
		action: classification.action,
		band: classification.band,
		tone: classification.tone,
		components: components.map((component) => ({
			label: component.label,
			symbol: component.symbol,
			value: component.value,
			weight: component.weight,
			marketTime: component.marketTime,
			reason: component.reason,
			fresh: component.fresh
		})),
		note:
			freshCount === components.length
				? 'Weighted US/Europe volatility blend for developed markets.'
				: `Degraded fallback to ${sourceLabel} due to stale components. Recommended minimum viable signal for global volatility.`
	};
}
