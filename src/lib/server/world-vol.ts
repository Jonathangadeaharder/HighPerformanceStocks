import { yahooFinance } from './infrastructure/yahoo';
import type { VolComponent, WorldVolSignal } from '$lib/types/dashboard';
import {
	buildCompositeWorldVolSignal,
	WORLD_VOL_PRIMARY_MAX_AGE_DAYS,
	WORLD_VOL_WEIGHTS
} from '$lib/domain/volatility/logic';

const VIX_SYMBOLS = ['^VIX', 'VIX'];
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
		'quotes' in chart && Array.isArray((chart as { quotes?: unknown }).quotes)
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
				return {
					label,
					symbol,
					weight,
					value: price,
					marketTime: quoteTime,
					fresh: true,
					reason: null
				};
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
	return (
		best ?? {
			label,
			symbol: fallbackSymbol,
			weight,
			value: null,
			marketTime: null,
			fresh: false,
			reason: 'all symbols failed'
		}
	);
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

	let finalResult = yfResult;

	const mwPrice = mwResult?.price ?? null;
	const mwTime = mwResult?.marketTime ?? null;
	const mwIsFresh = isFreshMarketTime(mwTime);

	if (yfResult.fresh && mwIsFresh && yfResult.value && mwPrice) {
		// Both are fresh. Cross-verify price discrepancy (tolerating ~2% intraday/closing differences)
		const diffPercent = Math.abs(yfResult.value - mwPrice) / yfResult.value;
		if (diffPercent > 0.05) {
			console.warn(`🚨 [VOL] ${label} YF/MW mismatch: YF=${yfResult.value}, MW=${mwPrice}`);
		} else {
			console.log(
				`✅ [VOL] ${label} successfully cross-verified. Difference ${diffPercent.toFixed(2)}%`
			);
		}
		// Prefer YF as the standard truth if it's fresh and verified
	} else if (!yfResult.fresh && mwIsFresh && mwPrice) {
		// YF failed or is stale (e.g. VSTOXX is chronically stale on YF). Use MW!
		console.log(
			`📡 [VOL] ${label} YF is stale/missing. Successfully routing fallback to stealth crawler: ${mwPrice}`
		);
		finalResult = {
			label,
			symbol: label,
			weight,
			value: mwPrice,
			marketTime: mwTime,
			fresh: true,
			reason: null
		};
	} else if (!yfResult.fresh && !mwIsFresh) {
		console.log(`⚠️ [VOL] ${label} both YF and MW are reporting stale data.`);
	}

	return finalResult;
}
export async function fetchWorldVolSignal(): Promise<WorldVolSignal> {
	if (cachedSignal && Date.now() - cachedSignal.timestamp < CACHE_TTL_MS) {
		return cachedSignal.signal;
	}

	const [vix, vstoxx] = await Promise.all([
		fetchCrossVerifiedVolIndex(VIX_SYMBOLS, 'vix', 'VIX', WORLD_VOL_WEIGHTS.vix),
		fetchCrossVerifiedVolIndex(
			VSTOXX_SYMBOLS,
			'v2tx?countrycode=xx',
			'VSTOXX',
			WORLD_VOL_WEIGHTS.vstoxx
		)
	]);

	// Ensure we shut the browser down if it was started
	const { closeBrowser } = await import('./infrastructure/crawlers/browser');
	await closeBrowser();

	let result: WorldVolSignal;
	const compositeSignal =
		vix.fresh || vstoxx.fresh ? buildCompositeWorldVolSignal([vix, vstoxx]) : null;

	if (compositeSignal) {
		result = compositeSignal;
	} else if (vix.fresh || vstoxx.fresh) {
		result = {
			available: false,
			source: 'Global developed volatility proxies',
			reason: 'Failed to build composite signal despite freshness.'
		};
	} else {
		const primaryIssues = [vix, vstoxx]
			.filter((component) => !component.fresh)
			.map((component) => `${component.label}: ${component.reason ?? 'unavailable'}`);

		result = {
			available: false,
			source: 'Global developed volatility proxies',
			reason: `Core volatility inputs unavailable (${primaryIssues.join('; ')}).`
		};
	}

	cachedSignal = { signal: result, timestamp: Date.now() };
	return result;
}
