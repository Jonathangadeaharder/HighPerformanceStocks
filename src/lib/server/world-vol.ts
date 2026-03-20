import YahooFinance from 'yahoo-finance2';
import type { AvailableWorldVolSignal, VolComponent, WorldVolSignal } from '$lib/types/dashboard';

const VIX_SYMBOL = '^VIX';
const VSTOXX_SYMBOL = '^V2TX'; // Trying the main ticker instead of .DE
const WORLD_VOL_PRIMARY_MAX_AGE_DAYS = 7;
const WORLD_VOL_WEIGHTS = {
	vix: 0.7,
	vstoxx: 0.3
} as const;

interface WeightedValue {
	value: number;
	weight: number;
}

const yahooFinance = new YahooFinance({
	validation: { logErrors: false },
	suppressNotices: ['yahooSurvey', 'ripHistorical']
});

function weightedAverage(values: WeightedValue[]): number | null {
	if (values.length === 0) return null;

	const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
	if (totalWeight === 0) return null;

	return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function formatDate(dateValue: Date | string | null | undefined): string | null {
	if (!dateValue) return null;

	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function classifyWorldVol(
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

function isFreshMarketTime(
	timeValue: string | null,
	maxAgeDays = WORLD_VOL_PRIMARY_MAX_AGE_DAYS
): boolean {
	if (!timeValue) return false;

	const ageMs = Date.now() - new Date(timeValue).getTime();
	return ageMs >= 0 && ageMs <= maxAgeDays * 86400000;
}

async function fetchVolIndexQuote(
	symbol: string,
	label: string,
	weight: number,
	retries = 2
): Promise<VolComponent> {
	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const quote = await yahooFinance.quote(symbol);
			const price =
				typeof quote.regularMarketPrice === 'number' && quote.regularMarketPrice > 0
					? +quote.regularMarketPrice.toFixed(1)
					: null;
			const rawMarketTime: string | number | Date | undefined = quote.regularMarketTime;
			const marketTime =
				rawMarketTime == null ? null : new Date(rawMarketTime).toISOString();
			const fresh = price !== null && isFreshMarketTime(marketTime);

			return {
				label,
				symbol,
				weight,
				value: price,
				marketTime,
				fresh,
				reason: fresh
					? null
					: price === null
						? 'missing price'
						: `stale quote (${formatDate(marketTime) ?? 'unknown date'})`
			};
		} catch (error: unknown) {
			if (attempt < retries) {
				await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
				continue;
			}
			return {
				label,
				symbol,
				weight,
				value: null,
				marketTime: null,
				fresh: false,
				reason: error instanceof Error ? error.message : 'quote fetch failed'
			};
		}
	}
	return {
		label,
		symbol,
		weight,
		value: null,
		marketTime: null,
		fresh: false,
		reason: 'max retries exceeded'
	};
}

function buildCompositeWorldVolSignal(components: VolComponent[]): AvailableWorldVolSignal | null {
	const weightedValues = components.flatMap((component) => {
		return component.value === null || !component.fresh
			? []
			: [{ value: component.value, weight: component.weight }];
	});
	const impliedVol = weightedAverage(weightedValues);
	if (impliedVol === null) return null;

	const classification = classifyWorldVol(impliedVol);

	// If only VIX is fresh, we're basically doing 100% VIX
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

export async function fetchWorldVolSignal(): Promise<WorldVolSignal> {
	const [vix, vstoxx] = await Promise.all([
		fetchVolIndexQuote(VIX_SYMBOL, 'VIX', WORLD_VOL_WEIGHTS.vix),
		fetchVolIndexQuote(VSTOXX_SYMBOL, 'VSTOXX', WORLD_VOL_WEIGHTS.vstoxx)
	]);

	// As long as VIX is fresh, we can build a valid signal (degrades gracefully)
	if (vix.fresh) {
		const compositeSignal = buildCompositeWorldVolSignal([vix, vstoxx]);
		if (compositeSignal) return compositeSignal;
	}

	const primaryIssues = [vix, vstoxx]
		.filter((component) => !component.fresh)
		.map((component) => `${component.label}: ${component.reason ?? 'unavailable'}`);

	return {
		available: false,
		source: 'Global developed volatility proxies',
		reason: `Core volatility inputs unavailable (${primaryIssues.join('; ')}).`
	};
}
