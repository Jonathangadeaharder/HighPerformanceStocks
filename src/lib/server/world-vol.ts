import YahooFinance from 'yahoo-finance2';
import type { AvailableWorldVolSignal, VolComponent, WorldVolSignal } from '$lib/types/dashboard';

const VIX_SYMBOL = '^VIX';
const VSTOXX_SYMBOL = 'V2TX.DE';
const WORLD_VOL_SYMBOL = 'URTH';
const WORLD_VOL_PRIMARY_MAX_AGE_DAYS = 7;
const WORLD_VOL_TARGET_DAYS = 30;
const WORLD_VOL_MAX_MONEYNESS_GAP = 0.1;
const WORLD_VOL_WEIGHTS = {
	vix: 0.7,
	vstoxx: 0.3
} as const;

interface WeightedValue {
	value: number;
	weight: number;
}

interface VolCandidate {
	strike: number;
	iv: number;
	distance: number;
}

interface OptionContractLike {
	strike?: number | null;
	impliedVolatility?: number | null;
}

interface ValidOptionContract {
	strike: number;
	impliedVolatility: number;
}

interface OptionSetLike {
	calls?: OptionContractLike[];
	puts?: OptionContractLike[];
	expirationDate?: Date | string | null;
}

const yahooFinance = new YahooFinance({
	validation: { logErrors: false },
	suppressNotices: ['yahooSurvey', 'ripHistorical']
});

function average(values: number[]): number | null {
	if (values.length === 0) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values: WeightedValue[]): number | null {
	if (values.length === 0) return null;

	const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
	if (totalWeight === 0) return null;

	return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function daysUntil(dateValue: Date | string): number {
	const ms = new Date(dateValue).getTime() - Date.now();
	return Math.max(0, Math.round(ms / 86400000));
}

function formatDate(dateValue: Date | string | null | undefined): string | null {
	if (!dateValue) return null;

	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function pickClosestExpiry(
	expirationDates: (Date | string)[] | undefined,
	targetDays = WORLD_VOL_TARGET_DAYS
): Date | string | null {
	if (!expirationDates?.length) return null;

	return (
		expirationDates.reduce<{ date: Date | string; diff: number } | null>((best, dateValue) => {
			const diff = Math.abs(daysUntil(dateValue) - targetDays);
			if (!best || diff < best.diff) {
				return { date: dateValue, diff };
			}

			return best;
		}, null)?.date ?? null
	);
}

function buildVolCandidates(
	options: OptionSetLike | undefined,
	underlyingPrice: number | null | undefined
): VolCandidate[] {
	if (!options || !underlyingPrice) return [];

	const maxGap = underlyingPrice * WORLD_VOL_MAX_MONEYNESS_GAP;
	const contracts = [...(options.calls ?? []), ...(options.puts ?? [])];

	return contracts
		.filter((contract): contract is ValidOptionContract => {
			return (
				typeof contract.strike === 'number' &&
				contract.strike > 0 &&
				typeof contract.impliedVolatility === 'number' &&
				contract.impliedVolatility > 0 &&
				Math.abs(contract.strike - underlyingPrice) <= maxGap
			);
		})
		.map((contract) => ({
			strike: contract.strike,
			iv: contract.impliedVolatility,
			distance: Math.abs(contract.strike - underlyingPrice)
		}))
		.toSorted((left, right) => left.distance - right.distance)
		.slice(0, 4);
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
	weight: number
): Promise<VolComponent> {
	try {
		const quote = await yahooFinance.quote(symbol);
		const price =
			typeof quote.regularMarketPrice === 'number' && quote.regularMarketPrice > 0
				? +quote.regularMarketPrice.toFixed(1)
				: null;
		const marketTime = quote.regularMarketTime
			? new Date(quote.regularMarketTime).toISOString()
			: null;
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

function buildCompositeWorldVolSignal(components: VolComponent[]): AvailableWorldVolSignal | null {
	const weightedValues = components.flatMap((component) => {
		return component.value === null ? [] : [{ value: component.value, weight: component.weight }];
	});
	const impliedVol = weightedAverage(weightedValues);
	if (impliedVol === null) return null;

	const classification = classifyWorldVol(impliedVol);

	return {
		available: true,
		method: 'composite',
		source: '70% VIX + 30% VSTOXX',
		impliedVol: +impliedVol.toFixed(1),
		action: classification.action,
		band: classification.band,
		tone: classification.tone,
		components: components.map((component) => ({
			label: component.label,
			symbol: component.symbol,
			value: component.value,
			weight: component.weight,
			marketTime: component.marketTime
		})),
		note: 'Weighted US/Europe volatility blend for developed markets. This is a proxy, not an official MSCI World volatility index.'
	};
}

async function fetchUrthWorldVolSignal(): Promise<WorldVolSignal> {
	try {
		const rootChain = await yahooFinance.options(WORLD_VOL_SYMBOL);
		const expiry = pickClosestExpiry(rootChain.expirationDates);
		if (!expiry) {
			return {
				available: false,
				source: 'URTH options fallback',
				reason: 'No listed option expiries were returned.'
			};
		}

		const sameExpiry = formatDate(rootChain.options[0]?.expirationDate) === formatDate(expiry);
		const chain = sameExpiry
			? rootChain
			: await yahooFinance.options(WORLD_VOL_SYMBOL, { date: expiry });
		const underlyingPrice =
			typeof chain.quote.regularMarketPrice === 'number'
				? chain.quote.regularMarketPrice
				: rootChain.quote.regularMarketPrice;
		const optionSet = chain.options[0] as OptionSetLike | undefined;
		const candidates = buildVolCandidates(optionSet, underlyingPrice);
		const rawVol = average(candidates.map((candidate) => candidate.iv));

		if (rawVol === null) {
			return {
				available: false,
				source: 'URTH options fallback',
				reason: 'No valid near-ATM implied volatility data was available.'
			};
		}

		const impliedVol = +(rawVol * 100).toFixed(1);
		const classification = classifyWorldVol(impliedVol);

		return {
			available: true,
			method: 'urth_fallback',
			symbol: WORLD_VOL_SYMBOL,
			source: 'URTH options fallback',
			expiry: formatDate(expiry),
			daysToExpiry: daysUntil(expiry),
			impliedVol,
			action: classification.action,
			band: classification.band,
			tone: classification.tone,
			underlyingPrice: typeof underlyingPrice === 'number' ? +underlyingPrice.toFixed(2) : null,
			sampleSize: candidates.length,
			note: 'URTH options proxy for MSCI World implied volatility, used when the direct VIX/VSTOXX composite is unavailable.'
		};
	} catch (error: unknown) {
		return {
			available: false,
			source: 'URTH options fallback',
			reason: error instanceof Error ? error.message : 'Unknown Yahoo Finance error.'
		};
	}
}

export async function fetchWorldVolSignal(): Promise<WorldVolSignal> {
	const [vix, vstoxx] = await Promise.all([
		fetchVolIndexQuote(VIX_SYMBOL, 'VIX', WORLD_VOL_WEIGHTS.vix),
		fetchVolIndexQuote(VSTOXX_SYMBOL, 'VSTOXX', WORLD_VOL_WEIGHTS.vstoxx)
	]);

	if (vix.fresh && vstoxx.fresh) {
		const compositeSignal = buildCompositeWorldVolSignal([vix, vstoxx]);
		if (compositeSignal) return compositeSignal;
	}

	const urthFallback = await fetchUrthWorldVolSignal();
	const primaryIssues = [vix, vstoxx]
		.filter((component) => component.fresh !== true)
		.map((component) => `${component.label}: ${component.reason ?? 'unavailable'}`);

	if (urthFallback.available) {
		return {
			...urthFallback,
			primarySource: '70% VIX + 30% VSTOXX',
			components: [vix, vstoxx].map((component) => ({
				label: component.label,
				symbol: component.symbol,
				value: component.value,
				weight: component.weight,
				marketTime: component.marketTime,
				fresh: component.fresh ?? false,
				reason: component.reason ?? null
			})),
			note: `${urthFallback.note} Primary composite unavailable: ${primaryIssues.join('; ')}.`
		};
	}

	return {
		available: false,
		source: 'Global developed volatility proxies',
		reason: `Primary composite unavailable (${primaryIssues.join('; ')}) and URTH fallback unavailable (${urthFallback.reason}).`
	};
}
