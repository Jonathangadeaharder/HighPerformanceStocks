import { yahooFinance } from './infrastructure/yahoo';
import type { VolComponent, WorldVolSignal } from '$lib/types/dashboard';
import {
	buildCompositeWorldVolSignal,
	WORLD_VOL_PRIMARY_MAX_AGE_DAYS,
	WORLD_VOL_WEIGHTS
} from '$lib/domain/volatility/logic';

const VIX_SYMBOL = '^VIX';
// Yahoo Finance serves ^V2TX with a frozen regularMarketTime (known issue with European indices).
// We try the quote first, then fall back to chart() which has reliable dates.
// V2TX.DE is an alias that sometimes returns a fresher timestamp.
const VSTOXX_SYMBOLS = ['^V2TX', 'V2TX.DE'];

function formatDate(dateValue: Date | string | null | undefined): string | null {
	if (!dateValue) return null;
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function isFreshMarketTime(
	timeValue: string | null,
	maxAgeDays = WORLD_VOL_PRIMARY_MAX_AGE_DAYS
): boolean {
	if (!timeValue) return false;
	const ageMs = Date.now() - new Date(timeValue).getTime();
	return ageMs >= 0 && ageMs <= maxAgeDays * 86_400_000;
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
 */
interface ChartBar {
	date?: Date | string | null;
	close?: number | null;
}

function parseChartBar(entry: unknown): ChartBar | null {
	if (typeof entry !== 'object' || entry === null) return null;

	const candidate = entry as Record<string, unknown>;
	const date =
		candidate.date instanceof Date || typeof candidate.date === 'string' ? candidate.date : null;
	const close = typeof candidate.close === 'number' ? candidate.close : null;
	return { date, close };
}

function toIsoString(value: unknown): string | null {
	if (!(value instanceof Date) && typeof value !== 'number' && typeof value !== 'string') {
		return null;
	}

	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function tryChartFallback(
	symbol: string,
	label: string,
	weight: number
): Promise<VolComponent | null> {
	const now = new Date();
	const tenDaysAgo = new Date(now.getTime() - 10 * 86_400_000);
	const chart = await yahooFinance.chart(symbol, {
		period1: tenDaysAgo,
		period2: now,
		interval: '1d'
	});
	const quotes =
		'quotes' in chart &&
		Array.isArray((chart as { quotes?: unknown }).quotes)
			? (chart as { quotes: unknown[] }).quotes
			: [];
	const bars = quotes
		.map((entry) => parseChartBar(entry))
		.filter((bar): bar is ChartBar => bar !== null);
	const lastBar = bars.findLast((q) => q.close != null);
	if (lastBar?.date == null || lastBar.close == null) return null;

	const parsedDate = new Date(lastBar.date);
	if (Number.isNaN(parsedDate.getTime())) return null;
	const chartTime = parsedDate.toISOString();
	const chartPrice = +lastBar.close.toFixed(1);
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

			const quoteTime = toIsoString(quote.regularMarketTime);

			// Quote time is fresh — done
			if (isFreshMarketTime(quoteTime)) {
				return { label, symbol, weight, value: price, marketTime: quoteTime, fresh: true, reason: null };
			}

			// Quote time is stale/missing — try chart() for a reliable last-close date
			try {
				const chartResult = await tryChartFallback(symbol, label, weight);
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

async function fetchVolIndexWithFallback(
	symbols: readonly string[],
	label: string,
	weight: number
): Promise<VolComponent> {
	const fallbackSymbol = symbols[0] ?? '';

	const chooseBetter = (
		candidate: VolComponent,
		currentBest: VolComponent | null
	): VolComponent => {
		if (currentBest === null) return candidate;
		if (currentBest.value === null && candidate.value !== null) return candidate;
		if (currentBest.value !== null && candidate.value === null) return currentBest;

		const candidateTime = candidate.marketTime ? new Date(candidate.marketTime).getTime() : 0;
		const currentBestTime = currentBest.marketTime ? new Date(currentBest.marketTime).getTime() : 0;
		
		if (candidateTime > currentBestTime) {
			return candidate;
		}

		return currentBest;
	};

	let best: VolComponent | null = null;
	for (const symbol of symbols) {
		const result = await fetchVolIndexQuote(symbol, label, weight);
		if (result.fresh) return result;
		best = chooseBetter(result, best);
	}
	return best ?? {
		label,
		symbol: fallbackSymbol,
		weight,
		value: null,
		marketTime: null,
		fresh: false,
		reason: 'all symbols failed'
	};
}

export async function fetchUrthOptionsFallback(): Promise<WorldVolSignal | null> {
	try {
		const result = await yahooFinance.options('URTH');
		const optionsData = result.options?.[0];
		const calls = optionsData?.calls;
		const puts = optionsData?.puts;
		const underlyingPrice = result.quote.regularMarketPrice ?? 0;
		
		if (calls && puts && underlyingPrice > 0 && calls.length > 0 && puts.length > 0) {
			interface OptionContract { strike?: number, impliedVolatility?: number }
			const closestCall = calls.reduce((prev: OptionContract, curr: OptionContract) => 
				Math.abs((curr.strike || 0) - underlyingPrice) < Math.abs((prev.strike || 0) - underlyingPrice) ? curr : prev
			, calls[0] as OptionContract);
			const closestPut = puts.reduce((prev: OptionContract, curr: OptionContract) => 
				Math.abs((curr.strike || 0) - underlyingPrice) < Math.abs((prev.strike || 0) - underlyingPrice) ? curr : prev
			, puts[0] as OptionContract);
			
			const callIv = closestCall.impliedVolatility || 0;
			const putIv = closestPut.impliedVolatility || 0;
			const ivPct = ((callIv + putIv) / 2) * 100;
			
			if (ivPct > 0) {
				return {
					available: true,
					method: 'urth_fallback',
					source: 'URTH options implied volatility (near ATM)',
					impliedVol: +ivPct.toFixed(1),
					action: ivPct < 15 ? 'Buy 2x daily leverage' : (ivPct <= 25 ? 'Hold / do not add 2x' : 'Sell / reduce 2x'),
					band: ivPct < 15 ? '< 15' : (ivPct <= 25 ? '15-25' : '> 25'),
					tone: ivPct < 15 ? 'buy' : (ivPct <= 25 ? 'hold' : 'sell'),
					components: [
						{ label: 'URTH Call ATM IV', symbol: 'URTH', value: +(callIv * 100).toFixed(1), weight: 0.5, marketTime: null, fresh: true, reason: null },
						{ label: 'URTH Put ATM IV', symbol: 'URTH', value: +(putIv * 100).toFixed(1), weight: 0.5, marketTime: null, fresh: true, reason: null }
					],
					note: 'Degraded fallback using MSCI World ETF options due to unavailable or stale index data.'
				};
			}
		}
	} catch (error) {
		console.warn('URTH options fallback fetch failed:', error instanceof Error ? error.message : String(error));
	}
	return null;
}

export async function fetchWorldVolSignal(): Promise<WorldVolSignal> {
	const [vix, vstoxx] = await Promise.all([
		fetchVolIndexQuote(VIX_SYMBOL, 'VIX', WORLD_VOL_WEIGHTS.vix),
		fetchVolIndexWithFallback(VSTOXX_SYMBOLS, 'VSTOXX', WORLD_VOL_WEIGHTS.vstoxx)
	]);

	if (vix.fresh && vstoxx.fresh) {
		const compositeSignal = buildCompositeWorldVolSignal([vix, vstoxx]);
		if (compositeSignal) return compositeSignal;
	}

	const fallback = await fetchUrthOptionsFallback();
	if (fallback) return fallback;

	const primaryIssues = [vix, vstoxx]
		.filter((component) => !component.fresh)
		.map((component) => `${component.label}: ${component.reason ?? 'unavailable'}`);

	return {
		available: false,
		source: 'Global developed volatility proxies',
		reason: `Core volatility inputs unavailable (${primaryIssues.join('; ')}). URTH fallback also failed.`
	};
}
