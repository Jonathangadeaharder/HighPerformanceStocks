import YahooFinance from 'yahoo-finance2';
import type { AvailableWorldVolSignal, VolComponent, WorldVolSignal } from '$lib/types/dashboard';

const VIX_SYMBOL = '^VIX';
// Yahoo Finance serves ^V2TX with a frozen regularMarketTime (known issue with European indices).
// We try the quote first, then fall back to chart() which has reliable dates.
// V2TX.DE is an alias that sometimes returns a fresher timestamp.
const VSTOXX_SYMBOLS = ['^V2TX', 'V2TX.DE'];
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

function staleResult(
	label: string,
	symbol: string,
	weight: number,
	price: number,
	marketTime: string | null
): VolComponent {
	return {
		label,
		symbol,
		weight,
		value: price,
		marketTime,
		fresh: false,
		reason: `stale quote (${formatDate(marketTime) ?? 'unknown date'})`
	};
}

/**
 * Try chart() to get a reliable last-close date for a symbol.
 *
 * Yahoo Finance has a known bug where ^V2TX (and some other European indices) returns a
 * frozen/stale `regularMarketTime` in the quote endpoint even when the price is current.
 * The chart endpoint returns OHLCV bars with proper dates, so we use the last bar's
 * date as the definitive freshness timestamp when the quote time looks stale.
 */
interface ChartBar {
	date?: Date | string | null;
	close?: number | null;
}

async function tryChartFallback(
	symbol: string,
	label: string,
	weight: number,
	quotePriceAsDefault: number
): Promise<VolComponent | null> {
	const now = new Date();
	const tenDaysAgo = new Date(now.getTime() - 10 * 86400000);
	const chart = await yahooFinance.chart(symbol, {
		period1: tenDaysAgo,
		period2: now,
		interval: '1d'
	});
	// yahoo-finance2's chart() return type is unresolvable in this ESLint config (SvelteKit $lib
	// path aliases). We cast to ChartBar[] and suppress the resulting any-access warnings.
	/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/prefer-optional-chain, unicorn/no-negated-condition */
	const bars: ChartBar[] = Array.isArray(chart.quotes) ? (chart.quotes as unknown as ChartBar[]) : [];
	const lastBar = bars.findLast((q) => q.close != null);
	if (lastBar == null || lastBar.date == null) return null;
	const chartTime = new Date(lastBar.date as Date | string).toISOString();
	const chartPrice: number = lastBar.close != null ? +(lastBar.close as number).toFixed(1) : quotePriceAsDefault;
	/* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/prefer-optional-chain, unicorn/no-negated-condition */
	const fresh = isFreshMarketTime(chartTime);
	return {
		label,
		symbol,
		weight,
		value: chartPrice,
		marketTime: chartTime,
		fresh,
		reason: fresh ? null : `stale (last close ${formatDate(chartTime) ?? 'unknown date'})`
	};
}

async function fetchVolIndexQuote(
	symbol: string,
	label: string,
	weight: number,
	retries = 2
): Promise<VolComponent> {
	let lastError: string | null = null;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const quote = await yahooFinance.quote(symbol);
			const price =
				typeof quote.regularMarketPrice === 'number' && quote.regularMarketPrice > 0
					? +quote.regularMarketPrice.toFixed(1)
					: null;

			if (price === null) {
				lastError = 'missing price';
				if (attempt < retries) {
					await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
					continue;
				}
				break;
			}

			const rawMarketTime = quote.regularMarketTime;
			const quoteTime = rawMarketTime == null ? null : new Date(rawMarketTime).toISOString();

			// Quote time is fresh — done
			if (isFreshMarketTime(quoteTime)) {
				return { label, symbol, weight, value: price, marketTime: quoteTime, fresh: true, reason: null };
			}

			// Quote time is stale/missing — try chart() for a reliable last-close date
			try {
				const chartResult = await tryChartFallback(symbol, label, weight, price);
				if (chartResult) return chartResult;
			} catch {
				// chart() failed — fall through with what we have from quote
			}

			return staleResult(label, symbol, weight, price, quoteTime);
		} catch (error: unknown) {
			lastError = error instanceof Error ? error.message : 'quote fetch failed';
			if (attempt < retries) {
				await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)));
				continue;
			}
		}
	}

	return {
		label,
		symbol,
		weight,
		value: null,
		marketTime: null,
		fresh: false,
		reason: lastError ?? 'max retries exceeded'
	};
}

/**
 * Try multiple symbols for the same index (e.g. ^V2TX then V2TX.DE).
 * Returns the first result that has a fresh price, or the best non-null result.
 */
async function fetchVolIndexWithFallback(
	symbols: readonly string[],
	label: string,
	weight: number
): Promise<VolComponent> {
	let best: VolComponent | null = null;
	for (const symbol of symbols) {
		const result = await fetchVolIndexQuote(symbol, label, weight);
		if (result.fresh) return result;
		if (result.value !== null && best === null) best = result;
	}
	return best ?? {
		label,
		symbol: symbols[0],
		weight,
		value: null,
		marketTime: null,
		fresh: false,
		reason: 'all symbols failed'
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
		fetchVolIndexWithFallback(VSTOXX_SYMBOLS, 'VSTOXX', WORLD_VOL_WEIGHTS.vstoxx)
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
