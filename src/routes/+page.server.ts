import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PageServerLoad } from './$types';
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
} as const;

type ScenarioKey = 'bear' | 'base' | 'bull';
type DeploymentStatus = 'DEPLOY' | 'WAIT' | 'REJECT' | 'FAIL' | 'NO_DATA';
type ScreenerSignal = 'PASS' | 'WAIT' | 'REJECTED' | 'FAIL' | 'NO_DATA';
type VolTone = 'buy' | 'hold' | 'sell';

interface WeightedValue {
	value: number;
	weight: number;
}

interface VolCandidate {
	strike: number;
	iv: number;
	distance: number;
}

interface VolComponent {
	label: string;
	symbol: string;
	weight: number;
	value: number | null;
	marketTime: string | null;
	fresh?: boolean;
	reason?: string | null;
}

interface AvailableWorldVolSignal {
	available: true;
	method: 'composite' | 'urth_fallback';
	source: string;
	impliedVol: number;
	action: string;
	band: string;
	tone: VolTone;
	note: string;
	expiry?: string | null;
	daysToExpiry?: number;
	symbol?: string;
	underlyingPrice?: number | null;
	sampleSize?: number;
	primarySource?: string;
	components?: VolComponent[];
}

interface UnavailableWorldVolSignal {
	available: false;
	source: string;
	reason: string;
}

type WorldVolSignal = AvailableWorldVolSignal | UnavailableWorldVolSignal;

interface ScreenerInputs {
	multipleType?: string;
	multiple?: number;
	growth?: number;
	dividendYield?: number;
	debtPenalty?: boolean;
}

interface StabilizationRealityCheck {
	pass?: boolean;
	price?: number;
	price6mAgo?: number;
	price1mAgo?: number;
	low3m?: number;
	return6m?: number;
	return1m?: number;
	near3mLow?: boolean;
}

interface RevisionsRealityCheck {
	pass?: boolean;
	up30d?: number;
	down30d?: number;
}

interface ScreenerRealityChecks {
	stabilization?: StabilizationRealityCheck;
	revisions?: RevisionsRealityCheck;
}

interface ScreenerData {
	engine?: string;
	signal?: ScreenerSignal;
	score?: number;
	note?: string;
	inputs?: ScreenerInputs;
	realityChecks?: ScreenerRealityChecks;
}

interface CagrModel {
	horizon?: number;
	epsGrowth?: string;
	dividendYield?: string;
	exitPE?: Partial<Record<ScenarioKey, number>>;
	scenarios?: Partial<Record<ScenarioKey, string>>;
	basis?: string;
}

interface DeploymentInfo {
	status: DeploymentStatus;
	reason: string;
}

interface FindingStock {
	ticker: string;
	name?: string;
	group?: string;
	currentPrice?: string;
	targetPrice?: string;
	lastUpdated?: string;
	expectedCAGR?: string;
	bullCase?: string;
	bearCase?: string;
	cagrModel?: CagrModel;
	screener?: ScreenerData;
	upside?: number | null;
	baseCagr?: number | null;
	bearCagr?: number | null;
	bullCagr?: number | null;
	deployment?: DeploymentInfo;
	deploymentRank?: number | null;
	pickLabel?: string;
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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isFindingStock(value: unknown): value is FindingStock {
	return isRecord(value) && typeof value.ticker === 'string';
}

function parseFindingStock(contents: string): FindingStock | null {
	const parsed: unknown = JSON.parse(contents);
	return isFindingStock(parsed) ? parsed : null;
}

function parsePrice(value: string | null | undefined): number | null {
	if (!value) return null;

	const parsedNumber = Number.parseFloat(value.replace(/[^0-9.]/g, ''));
	if (Number.isNaN(parsedNumber)) return null;
	if (/\d\s*p$/i.test(value)) return parsedNumber / 100;
	return parsedNumber;
}

function parsePercent(value: string | null | undefined): number | null {
	if (!value) return null;

	const match = value.match(/-?\d+(?:\.\d+)?/);
	return match ? Number.parseFloat(match[0]) : null;
}

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
		.sort((left, right) => left.distance - right.distance)
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

async function fetchWorldVolSignal(): Promise<WorldVolSignal> {
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

function deploymentRank(stock: FindingStock): number {
	const base = stock.baseCagr ?? 0;
	const bear = stock.bearCagr ?? 0;
	const upside = Math.min(stock.upside ?? 0, 60);

	const valuationStrength =
		stock.screener?.engine === 'totalReturn'
			? Math.max(0, (stock.screener.score ?? 0) - 10) * 2.5
			: Math.max(0, 1.2 - (stock.screener?.score ?? 99)) * 25;

	return +(valuationStrength + base * 1.2 + bear * 0.8 + upside * 0.1).toFixed(1);
}

function hasLikelyValueFloor(stock: FindingStock): boolean {
	const stabilization = stock.screener?.realityChecks?.stabilization;
	const revisions = stock.screener?.realityChecks?.revisions;

	if (!stabilization?.near3mLow) return false;
	if (!revisions?.pass) return false;
	if ((revisions.up30d ?? 0) <= (revisions.down30d ?? 0)) return false;
	if ((stock.screener?.score ?? 99) > VALUE_FLOOR_MAX_SCORE) return false;
	if ((stock.upside ?? 0) < VALUE_FLOOR_UPSIDE) return false;

	return (
		(stock.bearCagr ?? -999) >= VALUE_FLOOR_BEAR_CAGR &&
		(stock.baseCagr ?? -999) >= VALUE_FLOOR_BASE_CAGR
	);
}

function assignDeployment(stock: FindingStock): void {
	const signal = stock.screener?.signal ?? 'NO_DATA';

	if (signal === 'PASS') {
		const clearsHurdle =
			(stock.baseCagr ?? -999) >= ETF_HURDLE_CAGR && (stock.bearCagr ?? -999) > BEAR_FLOOR_CAGR;
		stock.deployment = clearsHurdle
			? { status: 'DEPLOY', reason: 'Valuation, forward return, and stabilization all pass.' }
			: {
					status: 'FAIL',
					reason: `Does not clear the ${ETF_HURDLE_CAGR}% ETF hurdle with a positive bear case.`
				};
	} else if (signal === 'WAIT') {
		stock.deployment = hasLikelyValueFloor(stock)
			? {
					status: 'DEPLOY',
					reason:
						'Likely value floor: strong bear/base returns, deep upside, supportive revisions, and price already near the 3-month low.'
				}
			: { status: 'WAIT', reason: stock.screener?.note ?? 'Cheap, but still stabilizing.' };
	} else if (signal === 'REJECTED') {
		stock.deployment = {
			status: 'REJECT',
			reason: stock.screener?.note ?? 'Consensus is deteriorating.'
		};
	} else if (signal === 'FAIL') {
		stock.deployment = { status: 'FAIL', reason: stock.screener?.note ?? 'No valuation edge.' };
	} else {
		stock.deployment = { status: 'NO_DATA', reason: stock.screener?.note ?? 'Insufficient data.' };
	}
}

export const load: PageServerLoad = async () => {
	const dir = resolve('data/findings');
	const files = readdirSync(dir).filter((fileName) => fileName.endsWith('.json'));
	const worldVolSignal = await fetchWorldVolSignal();

	const stocks = files.flatMap((fileName) => {
		try {
			const parsedStock = parseFindingStock(readFileSync(resolve(dir, fileName), 'utf-8'));
			return parsedStock ? [parsedStock] : [];
		} catch {
			return [];
		}
	});

	for (const stock of stocks) {
		const currentPrice = parsePrice(stock.currentPrice);
		const targetPrice = parsePrice(stock.targetPrice);
		stock.upside =
			currentPrice !== null && targetPrice !== null
				? Math.round(((targetPrice - currentPrice) / currentPrice) * 100)
				: null;

		stock.baseCagr = parsePercent(stock.cagrModel?.scenarios?.base);
		stock.bearCagr = parsePercent(stock.cagrModel?.scenarios?.bear);
		stock.bullCagr = parsePercent(stock.cagrModel?.scenarios?.bull);

		assignDeployment(stock);
		stock.deploymentRank = stock.deployment?.status === 'DEPLOY' ? deploymentRank(stock) : null;
	}

	const deployNow = stocks
		.filter((stock) => stock.deployment?.status === 'DEPLOY')
		.sort(
			(left, right) => (right.deploymentRank ?? -Infinity) - (left.deploymentRank ?? -Infinity)
		);

	const topPicks = deployNow.slice(0, 3).map((stock, index) => ({
		...stock,
		pickLabel: ['Top Pick', 'Second Pick', 'Third Pick'][index] ?? 'Pick'
	}));

	const cheapWait = stocks
		.filter((stock) => stock.deployment?.status === 'WAIT')
		.sort((left, right) => (left.screener?.score ?? 999) - (right.screener?.score ?? 999));

	const watchlist = stocks
		.filter((stock) => !['DEPLOY', 'WAIT'].includes(stock.deployment?.status ?? ''))
		.sort((left, right) => {
			const order: Record<DeploymentStatus, number> = {
				REJECT: 0,
				FAIL: 1,
				NO_DATA: 2,
				DEPLOY: 3,
				WAIT: 4
			};
			const deploymentDiff =
				order[left.deployment?.status ?? 'NO_DATA'] - order[right.deployment?.status ?? 'NO_DATA'];
			if (deploymentDiff !== 0) return deploymentDiff;
			if (left.screener?.engine === right.screener?.engine) {
				return (left.screener?.score ?? 999) - (right.screener?.score ?? 999);
			}

			return left.screener?.engine === 'fPERG' ? -1 : 1;
		});

	const lastUpdated = stocks
		.reduce((latest, stock) => {
			return (stock.lastUpdated ?? '') > latest ? (stock.lastUpdated ?? latest) : latest;
		}, '')
		.slice(0, 10);

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
			reject: watchlist.filter((stock) => stock.deployment?.status === 'REJECT').length,
			fail: watchlist.filter((stock) => stock.deployment?.status === 'FAIL').length,
			noData: watchlist.filter((stock) => stock.deployment?.status === 'NO_DATA').length
		}
	};
};
