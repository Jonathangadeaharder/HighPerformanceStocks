import { readFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import YahooFinance from 'yahoo-finance2';

const ETF_HURDLE_CAGR = 14;
const BEAR_FLOOR_CAGR = 0;
const VALUE_FLOOR_BEAR_CAGR = 12;
const VALUE_FLOOR_BASE_CAGR = 18;
const VALUE_FLOOR_UPSIDE = 25;
const VALUE_FLOOR_MAX_SCORE = 0.65;
const VIX_SYMBOL = '^VIX';
const VSTOXX_SYMBOL = 'V2TX.DE';
const WORLD_VOL_SYMBOL = 'URTH';
const WORLD_VOL_PRIMARY_MAX_AGE_DAYS = 7;
const WORLD_VOL_TARGET_DAYS = 30;
const WORLD_VOL_MAX_MONEYNESS_GAP = 0.1;
const WORLD_VOL_WEIGHTS = {
	vix: 0.7,
	vstoxx: 0.3
};

const yahooFinance = new YahooFinance({
	validation: { logErrors: false },
	suppressNotices: ['yahooSurvey', 'ripHistorical']
});

function parsePrice(str) {
	if (!str) return null;
	const n = parseFloat(String(str).replace(/[^0-9.]/g, ''));
	if (isNaN(n)) return null;
	if (/\d\s*p$/i.test(str)) return n / 100;
	return n;
}

function parsePercent(str) {
	if (!str) return null;
	const m = String(str).match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

function average(values) {
	if (!values.length) return null;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightedAverage(values) {
	if (!values.length) return null;

	const totalWeight = values.reduce((sum, item) => sum + item.weight, 0);
	if (!totalWeight) return null;

	return values.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function daysUntil(dateString) {
	const ms = new Date(dateString).getTime() - Date.now();
	return Math.max(0, Math.round(ms / 86400000));
}

function formatDate(dateValue) {
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return null;
	return date.toISOString().slice(0, 10);
}

function pickClosestExpiry(expirationDates, targetDays = WORLD_VOL_TARGET_DAYS) {
	if (!expirationDates?.length) return null;

	return expirationDates.reduce((best, date) => {
		const diff = Math.abs(daysUntil(date) - targetDays);
		if (!best || diff < best.diff) {
			return { date, diff };
		}
		return best;
	}, null)?.date ?? null;
}

function buildVolCandidates(options, underlyingPrice) {
	if (!options || !underlyingPrice) return [];

	const maxGap = underlyingPrice * WORLD_VOL_MAX_MONEYNESS_GAP;
	const sides = [
		...(options.calls ?? []),
		...(options.puts ?? [])
	];

	return sides
		.filter((contract) => {
			return contract?.strike > 0
				&& contract?.impliedVolatility > 0
				&& Math.abs(contract.strike - underlyingPrice) <= maxGap;
		})
		.map((contract) => ({
			strike: contract.strike,
			iv: contract.impliedVolatility,
			distance: Math.abs(contract.strike - underlyingPrice)
		}))
		.sort((a, b) => a.distance - b.distance)
		.slice(0, 4);
}

function classifyWorldVol(impliedVol) {
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

function isFreshMarketTime(timeValue, maxAgeDays = WORLD_VOL_PRIMARY_MAX_AGE_DAYS) {
	if (!timeValue) return false;

	const ageMs = Date.now() - new Date(timeValue).getTime();
	return ageMs >= 0 && ageMs <= maxAgeDays * 86400000;
}

async function fetchVolIndexQuote(symbol, label, weight) {
	try {
		const quote = await yahooFinance.quote(symbol);
		const price = Number(quote?.regularMarketPrice);
		const marketTime = quote?.regularMarketTime ? new Date(quote.regularMarketTime).toISOString() : null;
		const fresh = Number.isFinite(price) && price > 0 && isFreshMarketTime(marketTime);

		return {
			symbol,
			label,
			weight,
			price: Number.isFinite(price) && price > 0 ? +price.toFixed(1) : null,
			marketTime,
			fresh,
			reason: fresh
				? null
				: (!Number.isFinite(price) || price <= 0)
					? 'missing price'
					: `stale quote (${formatDate(marketTime) ?? 'unknown date'})`
		};
	} catch (error) {
		return {
			symbol,
			label,
			weight,
			price: null,
			marketTime: null,
			fresh: false,
			reason: error instanceof Error ? error.message : 'quote fetch failed'
		};
	}
}

function buildCompositeWorldVolSignal(components) {
	const impliedVol = weightedAverage(components.map((component) => ({
		value: component.price,
		weight: component.weight
	})));

	if (impliedVol == null) return null;

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
			value: component.price,
			weight: component.weight,
			marketTime: component.marketTime
		})),
		note: 'Weighted US/Europe volatility blend for developed markets. This is a proxy, not an official MSCI World volatility index.'
	};
}

async function fetchUrthWorldVolSignal() {
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

		const chain = rootChain.options?.[0]?.expirationDate === expiry
			? rootChain
			: await yahooFinance.options(WORLD_VOL_SYMBOL, { date: expiry });

		const underlyingPrice = chain.quote?.regularMarketPrice ?? rootChain.quote?.regularMarketPrice;
		const optionSet = chain.options?.[0];
		const candidates = buildVolCandidates(optionSet, underlyingPrice);
		const rawVol = average(candidates.map((candidate) => candidate.iv));

		if (!rawVol) {
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
			underlyingPrice: underlyingPrice ? +underlyingPrice.toFixed(2) : null,
			sampleSize: candidates.length,
			note: 'URTH options proxy for MSCI World implied volatility, used when the direct VIX/VSTOXX composite is unavailable.'
		};
	} catch (error) {
		return {
			available: false,
			source: 'URTH options fallback',
			reason: error instanceof Error ? error.message : 'Unknown Yahoo Finance error.'
		};
	}
}

async function fetchWorldVolSignal() {
	const [vix, vstoxx] = await Promise.all([
		fetchVolIndexQuote(VIX_SYMBOL, 'VIX', WORLD_VOL_WEIGHTS.vix),
		fetchVolIndexQuote(VSTOXX_SYMBOL, 'VSTOXX', WORLD_VOL_WEIGHTS.vstoxx)
	]);

	if (vix.fresh && vstoxx.fresh) {
		return buildCompositeWorldVolSignal([vix, vstoxx]);
	}

	const urthFallback = await fetchUrthWorldVolSignal();
	const primaryIssues = [vix, vstoxx]
		.filter((component) => !component.fresh)
		.map((component) => `${component.label}: ${component.reason ?? 'unavailable'}`);

	if (urthFallback.available) {
		return {
			...urthFallback,
			primarySource: '70% VIX + 30% VSTOXX',
			components: [vix, vstoxx].map((component) => ({
				label: component.label,
				symbol: component.symbol,
				value: component.price,
				weight: component.weight,
				marketTime: component.marketTime,
				fresh: component.fresh,
				reason: component.reason
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

function deploymentRank(stock) {
	const base = stock.baseCagr ?? 0;
	const bear = stock.bearCagr ?? 0;
	const upside = Math.min(stock.upside ?? 0, 60);

	let valuationStrength = 0;
	if (stock.screener?.engine === 'totalReturn') {
		valuationStrength = Math.max(0, (stock.screener?.score ?? 0) - 10) * 2.5;
	} else {
		valuationStrength = Math.max(0, 1.2 - (stock.screener?.score ?? 99)) * 25;
	}

	return +(valuationStrength + base * 1.2 + bear * 0.8 + upside * 0.1).toFixed(1);
}

function hasLikelyValueFloor(stock) {
	const stabilization = stock.screener?.realityChecks?.stabilization;
	const revisions = stock.screener?.realityChecks?.revisions;

	if (!stabilization?.near3mLow) return false;
	if (!revisions?.pass) return false;
	if ((revisions.up30d ?? 0) <= (revisions.down30d ?? 0)) return false;
	if ((stock.screener?.score ?? 99) > VALUE_FLOOR_MAX_SCORE) return false;
	if ((stock.upside ?? 0) < VALUE_FLOOR_UPSIDE) return false;

	return (stock.bearCagr ?? -999) >= VALUE_FLOOR_BEAR_CAGR
		&& (stock.baseCagr ?? -999) >= VALUE_FLOOR_BASE_CAGR;
}

export async function load() {
	const dir = resolve('data/findings');
	const files = readdirSync(dir).filter(f => f.endsWith('.json'));
	const worldVolSignal = await fetchWorldVolSignal();

	const stocks = files.flatMap(f => {
		try {
			return [JSON.parse(readFileSync(resolve(dir, f), 'utf-8'))];
		} catch { return []; }
	});

	for (const s of stocks) {
		const cur = parsePrice(s.currentPrice);
		const tgt = parsePrice(s.targetPrice);
		s.upside = cur && tgt ? Math.round(((tgt - cur) / cur) * 100) : null;

		s.baseCagr = parsePercent(s.cagrModel?.scenarios?.base);
		s.bearCagr = parsePercent(s.cagrModel?.scenarios?.bear);
		s.bullCagr = parsePercent(s.cagrModel?.scenarios?.bull);

		const signal = s.screener?.signal ?? 'NO_DATA';
		if (signal === 'PASS') {
			const clearsHurdle = (s.baseCagr ?? -999) >= ETF_HURDLE_CAGR
				&& (s.bearCagr ?? -999) > BEAR_FLOOR_CAGR;
			s.deployment = clearsHurdle
				? { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' }
				: { status: 'FAIL', reason: `Does not clear the ${ETF_HURDLE_CAGR}% ETF hurdle with a positive bear case.` };
		} else if (signal === 'WAIT') {
			s.deployment = hasLikelyValueFloor(s)
				? { status: 'DEPLOY', reason: 'Likely value floor: strong bear/base returns, deep upside, supportive revisions, and price already near the 3-month low.' }
				: { status: 'WAIT', reason: s.screener?.note ?? 'Cheap, but still stabilizing.' };
		} else if (signal === 'REJECTED') {
			s.deployment = { status: 'REJECT', reason: s.screener?.note ?? 'Consensus is deteriorating.' };
		} else if (signal === 'FAIL') {
			s.deployment = { status: 'FAIL', reason: s.screener?.note ?? 'No valuation edge.' };
		} else {
			s.deployment = { status: 'NO_DATA', reason: s.screener?.note ?? 'Insufficient data.' };
		}

		s.deploymentRank = s.deployment.status === 'DEPLOY' ? deploymentRank(s) : null;
	}

	const deployNow = stocks
		.filter(s => s.deployment?.status === 'DEPLOY')
		.sort((a, b) => b.deploymentRank - a.deploymentRank);

	const topPicks = deployNow.slice(0, 3).map((stock, index) => ({
		...stock,
		pickLabel: ['Top Pick', 'Second Pick', 'Third Pick'][index] ?? 'Pick'
	}));

	const cheapWait = stocks
		.filter(s => s.deployment?.status === 'WAIT')
		.sort((a, b) => {
			return (a.screener?.score ?? 999) - (b.screener?.score ?? 999);
		});

	const watchlist = stocks
		.filter(s => !['DEPLOY', 'WAIT'].includes(s.deployment?.status))
		.sort((a, b) => {
			const order = { REJECT: 0, FAIL: 1, NO_DATA: 2 };
			const d = (order[a.deployment?.status] ?? 3) - (order[b.deployment?.status] ?? 3);
			if (d !== 0) return d;
			if (a.screener?.engine === b.screener?.engine) {
				return (a.screener?.score ?? 999) - (b.screener?.score ?? 999);
			}
			return a.screener?.engine === 'fPERG' ? -1 : 1;
		});

	const lastUpdated = stocks.reduce((latest, s) =>
		(s.lastUpdated ?? '') > latest ? s.lastUpdated : latest, '').slice(0, 10);

	return {
		worldVolSignal,
		topPicks,
		deployNow,
		cheapWait,
		watchlist,
		lastUpdated,
		hurdles: {
			etfCagr: ETF_HURDLE_CAGR,
			bearFloor: BEAR_FLOOR_CAGR
		},
		counts: {
			total: stocks.length,
			deploy: deployNow.length,
			wait: cheapWait.length,
			reject: watchlist.filter(s => s.deployment?.status === 'REJECT').length,
			fail: watchlist.filter(s => s.deployment?.status === 'FAIL').length,
			noData: watchlist.filter(s => s.deployment?.status === 'NO_DATA').length
		}
	};
}
