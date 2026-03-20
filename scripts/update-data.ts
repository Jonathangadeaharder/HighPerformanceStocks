import 'dotenv/config';

/**
 * update-data.js — Refresh all stock data from Yahoo Finance
 *
 * Dynamically updates:
 *   currentPrice, marketCap, valuation (PE/PEG/EV-EBITDA), metrics (ROE, FCF margin/yield,
 *   net debt/EBITDA, Rule of 40, gross/op margins), consensus.yahoo (analyst target),
 *   analystTargets (low/mean/high), cagrModel (ttmEPS, epsGrowth, dividendYield, scenarios),
 *   expectedCAGR
 *
 * Keeps manual:
 *   group, bullCase, bearCase, cagrModel.basis, sharpeRatio,
 *   expectedVolatility, tipranks/stockanalysis consensus
 *
 * Usage:
 *   pnpm update-data           # skips stocks already updated today
 *   pnpm update-data --force   # re-fetches all regardless of lastUpdated
 */

import { readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import {
	calcForwardScenarios,
	parseDisplayPrice,
	parsePercent
} from '../lib/finance-core.js';
import { STOCK_RECORDS_DIR } from '../lib/project-paths.js';
import {
	fmtApproxPct,
	fmtMarketCap,
	fmtMultiple,
	fmtPct,
	fmtPrice,
	fmtRoundPct,
	isUpToDate,
	sleep
} from './lib/display-formatters.js';
import { computeScreener } from './lib/screener.js';
import {
	fetchAllQuotes,
	fetchHistoricalData,
	fetchSummary,
	yahooTicker
} from './lib/yahoo-client.js';

const DATA_DIR = STOCK_RECORDS_DIR;
const CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;
const FORCE = process.argv.includes('--force');

function atomicWriteJson(path: string, data: object): void {
	const tempPath = join(tmpdir(), `stock-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp.json`);
	writeFileSync(tempPath, JSON.stringify(data, null, '\t') + '\n');
	renameSync(tempPath, path);
}

function computeQCS(summary: any, cvStock = 0.08) {
	if (!summary) return;

	// 1. Forecast Credibility Score (Standardized Surprise)
	// Calculates average surprise magnitude and penalizes for high analyst dispersion (CV).
	let totalSurprise = 0;
	let validQuarters = 0;
	const history = summary.earningsHistory?.history || [];
	for (const q of history) {
		if (typeof q.surprisePercent === 'number') {
			totalSurprise += q.surprisePercent;
			validQuarters++;
		}
	}

	let avgSurprise = 0;
	let earningsScore = 0;
	if (validQuarters > 0) {
		avgSurprise = totalSurprise / validQuarters;
		const cvBenchmark = 0.08;
		const safeCvStock = Math.max(0.01, cvStock); // Prevent division by zero

		// Formula: (Avg Surprise * 50) * (CV Benchmark / CV Stock)
		earningsScore = (avgSurprise * 50) * (cvBenchmark / safeCvStock);
		earningsScore = +(Math.max(-5, Math.min(5, earningsScore))).toFixed(2);
	}

	const netInsiderShares = summary.netSharePurchaseActivity?.netInfoShares || 0;
	let instDelta = 0;
	const instList = summary.institutionOwnership?.ownershipList || [];
	for (const inst of instList) {
		if (inst.pctChange && inst.pctHeld) {
			instDelta += inst.pctChange * inst.pctHeld;
		}
	}

	let flowScore = 0;
	let instFlowTrend = 'neutral';
	if (instDelta > 0.005) instFlowTrend = 'positive';
	else if (instDelta < -0.005) instFlowTrend = 'negative';

	if (netInsiderShares > 0 && instFlowTrend === 'positive') {
		flowScore = 5;
	} else if (instFlowTrend === 'positive') {
		flowScore = 2.5;
	} else if (netInsiderShares < -1000 && instFlowTrend === 'negative') {
		flowScore = -5;
	}

	let upRevisions = 0;
	let downRevisions = 0;
	let totalAnalysts = 1;
	const trend = summary.earningsTrend?.trend?.find((t: any) => t.period === '0y') ||
				  summary.earningsTrend?.trend?.find((t: any) => t.period === '+1y');

	if (trend) {
		upRevisions = trend.epsRevisions?.upLast30days || 0;
		downRevisions = trend.epsRevisions?.downLast30days || 0;
		totalAnalysts = trend.earningsEstimate?.numberOfAnalysts || Math.max(1, upRevisions + downRevisions);
	}

	const revisionsScore = +(((upRevisions - downRevisions) / totalAnalysts) * 5).toFixed(2);

	// Cap total score to +/- 15 to match the old qualitative system
	let totalScore = +(earningsScore + flowScore + revisionsScore).toFixed(2);
	totalScore = Math.max(-15, Math.min(15, totalScore));

	return {
		earningsScore,
		flowScore,
		revisionsScore,
		totalScore,
		raw: {
			avgSurprisePct: validQuarters > 0 ? +(totalSurprise / validQuarters * 100).toFixed(2) : 0,
			netInsiderShares,
			instFlowTrend,
			upRevisions,
			downRevisions,
			totalAnalysts
		}
	};
}

// ─── Apply updates to one stock ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function applyUpdates(stock: any, quote: any, summary: any, historicalData: any) {
	const currency = quote.currency;
	if (!currency) {
		console.log(`  ⚠️  ${stock.ticker} — missing currency field, skipping`);
		return false;
	}
	const rawPrice = quote.regularMarketPrice;
	if (!rawPrice) return false;

	const isGBp = currency === 'GBp' || currency === 'GBX';
	// For calculations, always work in "display" units (pounds for GBp, not pence)
	const priceForCalc = isGBp ? rawPrice / 100 : rawPrice;

	const sd = summary?.summaryDetail ?? {};
	const ks = summary?.defaultKeyStatistics ?? {};
	const fd = summary?.financialData ?? {};

	// ── currentPrice ──
	stock.currentPrice = fmtPrice(rawPrice, currency);

	// ── marketCap ──
	const rawCap = quote.marketCap ?? sd.marketCap;
	if (rawCap) stock.marketCap = fmtMarketCap(rawCap, currency);

	// ── valuation ──
	if (!stock.valuation) stock.valuation = {};
	if (stock.valuation) {
		const pe = quote.trailingPE ?? sd.trailingPE;
		const fpe = quote.forwardPE ?? sd.forwardPE;
		const peg = ks.pegRatio;
		let evEbitda = ks.enterpriseToEbitda;

		const totalDebt = fd.totalDebt;
		const totalCash = fd.totalCash;
		const ebitda = fd.ebitda;

		if (ks.enterpriseValue && rawCap && totalDebt != null && totalCash != null && ebitda) {
			const calcEv = rawCap + totalDebt - totalCash;
			// Catch Yahoo API stock split corruption (e.g. AVGO 10-for-1 split dropping EV by 10x)
			if (calcEv / ks.enterpriseValue > 2) {
				console.log(`  🚨  ${stock.ticker} — Yahoo EV corrupted (Reported: $${Math.round(ks.enterpriseValue/1e9)}B, Calc'd: $${Math.round(calcEv/1e9)}B). Overriding EV/EBITDA.`);
				evEbitda = calcEv / ebitda;
			}
		}

		if (pe != null) stock.valuation.trailingPE = +pe.toFixed(1);
		if (fpe != null) stock.valuation.forwardPE = +fpe.toFixed(1);
		if (peg != null) stock.valuation.pegRatio = +peg.toFixed(2);
		// Skip EV/EBITDA for alt-asset managers (consolidated balance sheets distort it)
		if (evEbitda != null && stock.valuation.evEbitda !== null) {
			const isMegaCap = rawCap && rawCap > 50_000_000_000;
			if (isMegaCap && evEbitda < 5) {
				console.log(`  ⚠️  ${stock.ticker} — anomalous EV/EBITDA (${evEbitda.toFixed(1)}) for mega-cap, rejecting`);
				stock.valuation.evEbitda = null;
			} else {
				stock.valuation.evEbitda = +evEbitda.toFixed(1);
			}
		}
	}

	// ── metrics ──
	if (!stock.metrics) stock.metrics = {};
	if (stock.metrics) {
		const roe = fd.returnOnEquity;
		if (roe != null) stock.metrics.roe = fmtPct(roe * 100, 1);

		const fcf = fd.freeCashflow;
		const rev = fd.totalRevenue;
		const fcfMarginPct = fcf != null && rev != null && rev > 0 ? (fcf / rev) * 100 : null;
		if (fcfMarginPct != null) stock.metrics.fcfMargin = fmtApproxPct(fcfMarginPct);

		// FCF yield uses market cap in same currency (rawCap is in native units, rawCap for GBp would be in pence * shares)
		// Yahoo's marketCap for GBp stocks is already in £ (Yahoo normalises it to major currency)
		if (fcf != null && rawCap != null && rawCap > 0) {
			const fcfYieldPct = isGBp ? (fcf / rawCap) * 100 : (fcf / rawCap) * 100;
			stock.metrics.fcfYield = `~${Math.round(fcfYieldPct)}%`;
		}

		const totalDebt = fd.totalDebt;
		const totalCash = fd.totalCash;
		const ebitda = fd.ebitda;
		// Skip Net Debt/EBITDA if marked "N/M" (alt-asset consolidated balance sheets)
		const isNM = /^N\/M/i.test(stock.metrics.netDebtEbitda ?? '');
		if (!isNM && totalDebt != null && totalCash != null && ebitda != null && Math.abs(ebitda) > 0) {
			const netDebt = totalDebt - totalCash;
			stock.metrics.netDebtEbitda = netDebt < 0 ? 'Net cash' : fmtMultiple(netDebt / ebitda);
		}

		// Rule of 40: revenue growth % + FCF margin %
		const revGrowth = fd.revenueGrowth;
		if (revGrowth != null && fcfMarginPct != null) {
			stock.metrics.ruleOf40 = fmtRoundPct(revGrowth * 100 + fcfMarginPct);
		}

		// Optional fields — only update if already present in JSON
		if (stock.metrics.grossMargin !== undefined && fd.grossMargins != null) {
			stock.metrics.grossMargin = fmtPct(fd.grossMargins * 100, 2);
		}
		if (stock.metrics.operatingMargin !== undefined && fd.operatingMargins != null) {
			stock.metrics.operatingMargin = fmtApproxPct(fd.operatingMargins * 100);
		}
		if (stock.metrics.ebitdaMargin !== undefined && fd.ebitdaMargins != null) {
			stock.metrics.ebitdaMargin = fmtApproxPct(fd.ebitdaMargins * 100);
		}
		if (stock.metrics.beta !== undefined && (sd.beta ?? ks.beta) != null) {
			stock.metrics.beta = String(+(sd.beta ?? ks.beta).toFixed(2));
		}
		if (stock.metrics.revenueGrowth !== undefined && revGrowth != null) {
			stock.metrics.revenueGrowth = fmtPct(revGrowth * 100, 1);
		}
	}

	// ── consensus.yahoo (analyst mean target price) ──
	if (fd.targetMeanPrice != null) {
		const isAnomalous = fd.targetMeanPrice > rawPrice * 3 || fd.targetMeanPrice < rawPrice * 0.5;
		if (isAnomalous) {
			console.log(`  ⚠️  ${stock.ticker} — anomalous target price (${fd.targetMeanPrice} vs price ${rawPrice}), skipping consensus update (currency bug)`);
		} else {
			if (!stock.consensus) stock.consensus = {};
			stock.consensus.yahoo = fmtPrice(fd.targetMeanPrice, currency);
			stock.targetPrice = stock.consensus.yahoo;
		}
	}

	// ── analystTargets & forward return scenarios ──
	// Yahoo returns targets in native currency (pence for GBp). Convert to display units (pounds).
	// Reject single-analyst targets (low === mean === high) as scenarios are meaningless.
	if (fd.targetLowPrice != null && fd.targetMeanPrice != null && fd.targetHighPrice != null) {
		const isAnomalous = fd.targetMeanPrice > rawPrice * 3 || fd.targetMeanPrice < rawPrice * 0.5;
		const isSingleAnalyst = fd.targetLowPrice === fd.targetMeanPrice && fd.targetMeanPrice === fd.targetHighPrice;
		if (!isAnomalous && !isSingleAnalyst) {
			const divisor = isGBp ? 100 : 1;
			stock.analystTargets = {
				low: +(fd.targetLowPrice / divisor).toFixed(2),
				mean: +(fd.targetMeanPrice / divisor).toFixed(2),
				high: +(fd.targetHighPrice / divisor).toFixed(2)
			};
		} else if (isSingleAnalyst) {
			console.log(`  ⚠️  ${stock.ticker} — single analyst target (${fd.targetMeanPrice}), skipping analystTargets`);
			delete stock.analystTargets;
		}
	}

	// ── cagrModel ──
	const model = stock.cagrModel;
	if (model) {
		// Auto-derive EPS Growth from Yahoo earningsTrend ONLY if:
		// 1. epsGrowthSource is explicitly 'auto' (user requested auto-updates), OR
		// 2. epsGrowth is completely missing (new stock initialization)
		// Existing values without a source flag are treated as 'manual' (preserved)
		if (model.epsGrowthSource === 'auto' || (!model.epsGrowth && !model.epsGrowthSource)) {
			const currentYearTrend = summary?.earningsTrend?.trend?.find((t: any) => t.period === '0y');
			const nextYearTrend = summary?.earningsTrend?.trend?.find((t: any) => t.period === '+1y');

			if (currentYearTrend?.earningsEstimate?.avg && nextYearTrend?.earningsEstimate?.avg) {
				const currentEps = currentYearTrend.earningsEstimate.avg;
				const nextEps = nextYearTrend.earningsEstimate.avg;
				const impliedGrowth = ((nextEps / currentEps) - 1) * 100;

				// Cap at 35% to avoid analyst optimism bias (Chan, Karceski & Lakonishok 2003)
				const cappedGrowth = Math.min(35, Math.max(-10, impliedGrowth));
				model.epsGrowth = `${Math.round(cappedGrowth)}%`;
				model.epsGrowthSource = 'auto';
				console.log(`  📊 ${stock.ticker} — auto EPS growth: ${model.epsGrowth} (from analyst estimates)`);
			}
		}

		// TTM EPS — Yahoo returns EPS in the stock's major currency (£ for GBp stocks, not pence)
		// Skip for stocks using adjusted/normalized EPS (Yahoo returns GAAP; our model uses adjusted)
		let ttmEpsRaw = quote.epsTrailingTwelveMonths;

		// ── Override for Alternative Asset Managers (Use Non-GAAP Consensus) ──
		// GAAP EPS for Alt Managers is heavily distorted by M&A amortization.
		// Analysts model Fee-Related Earnings (FRE/DE) which Yahoo surfaces as the
		// current year consensus estimate ('0y') in the earningsTrend module.
		if (stock.group?.includes('Alt Assets') || /FRE|Distributable/i.test(model.basis ?? '')) {
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const currentYearTrend = summary?.earningsTrend?.trend?.find((t: any) => t.period === '0y');
			if (currentYearTrend?.earningsEstimate?.avg) {
				ttmEpsRaw = currentYearTrend.earningsEstimate.avg;

				// Recalculate trailing PE manually since Yahoo trailing PE uses the distorted GAAP EPS
				if (stock.valuation && rawPrice && ttmEpsRaw > 0) {
					stock.valuation.trailingPE = +(priceForCalc / ttmEpsRaw).toFixed(1);
				}
			}
		}

		if (ttmEpsRaw != null && ttmEpsRaw > 0) {
			const basis = model.basis ?? '';
			const isAdjusted = /adjusted|normalized|distributable|ANI|non-IFRS|CFO|FCFA2S/i.test(basis);
			const newEps = Math.round(ttmEpsRaw * 100) / 100;

			if (!isAdjusted || model.ttmEPS === undefined) {
				// Sanity check: warn if change exceeds 50% (possible unit/currency bug)
				// With --force, update anyway (legitimate crashes e.g. MU downcycle can exceed 50%)
				if (model.ttmEPS && Math.abs(newEps - model.ttmEPS) / model.ttmEPS > 0.5) {
					if (!FORCE) {
						console.log(
							`  ⚠️  ${stock.ticker} — ttmEPS change >50% (${model.ttmEPS} → ${newEps}), skipping entire update (run --force to override)`
						);
						return false;
					}
					console.log(
						`  ⚠️  ${stock.ticker} — ttmEPS change >50% (${model.ttmEPS} → ${newEps}), updating (--force)`
					);
				}
				if (isAdjusted) {
					console.log(
						`  ⚠️  ${stock.ticker} — missing adjusted ttmEPS, initializing with GAAP ${newEps}`
					);
				}
				model.ttmEPS = newEps;
			}
		}

		// Dividend yield — skip for stocks with special/irregular dividends (Yahoo only reports regular)
		const hasSpecialDividends = /special dividend/i.test(model.basis ?? '');
		if (!hasSpecialDividends) {
			const rawDy = sd.dividendYield ?? quote.trailingAnnualDividendYield;
			if (rawDy != null) {
				const dyPct = rawDy * 100;
				if (dyPct > 25) {
					console.log(`  ⚠️  ${stock.ticker} — anomalous dividend yield (${dyPct.toFixed(0)}%), skipping (likely currency unit mismatch)`);
				} else {
					model.dividendYield = fmtRoundPct(dyPct);
				}
			}
		}

		// Recalculate scenarios from analyst targets (1-year forward returns)
		const dyPct = parsePercent(model.dividendYield) || 0;
		if (stock.analystTargets?.low && stock.analystTargets?.mean && stock.analystTargets?.high) {
			const scenarios = calcForwardScenarios({
				currentPrice: priceForCalc,
				targetLow: stock.analystTargets.low,
				targetMean: stock.analystTargets.mean,
				targetHigh: stock.analystTargets.high,
				dividendYieldPct: dyPct
			});
			model.scenarios = {
				bear: fmtRoundPct(scenarios.bear),
				base: fmtRoundPct(scenarios.base),
				bull: fmtRoundPct(scenarios.bull)
			};

			stock.expectedCAGR = `${Math.round(scenarios.bear)}% - ${Math.round(scenarios.bull)}%`;
		} else {
			// No analyst targets — clear stale scenarios
			delete model.scenarios;
			delete stock.expectedCAGR;
		}

		// Clean up legacy fields if they exist
		delete model.exitPE;
		delete model.exitPESource;
		delete model.horizon;
		delete model.decayFactor;
	}

	// ── Realized volatility (1yr annualized) ──
	const realizedVol = historicalData?.vol;
	if (realizedVol != null) {
		stock.expectedVolatility = `~${realizedVol}%`;
	}

	// ── Sharpe ratio (derived: midpoint return over risk-free, divided by volatility) ──
	const vol = parsePercent(stock.expectedVolatility);
	if (vol != null && vol > 0 && stock.cagrModel?.scenarios) {
		const bearS = parsePercent(stock.cagrModel.scenarios.bear);
		const bullS = parsePercent(stock.cagrModel.scenarios.bull);
		if (bearS != null && bullS != null) {
			const midReturn = (bearS + bullS) / 2;
			const RISK_FREE = 4.5;
			stock.sharpeRatio = +((midReturn - RISK_FREE) / vol).toFixed(2);
		}
	}

	// ── Bifurcated screener (fPERG / Total Return) ──
	stock.screener = computeScreener(stock, summary, rawPrice, priceForCalc, historicalData);

	// ── Quantitative Conviction Score (QCS) ──
	const cvStock = stock.screener?.inputs?.cvStock || 0.08;
	const qcsData = computeQCS(summary, cvStock);
	if (qcsData) {
		stock.qcs = qcsData;
	}

	// ── description ──
	if (summary?.assetProfile?.longBusinessSummary) {
		const sentences = summary.assetProfile.longBusinessSummary.split('. ');
		let brief = sentences[0];
		if (brief.length < 50 && sentences.length > 1) {
			brief += '. ' + sentences[1];
		}
		if (!brief.endsWith('.')) brief += '.';
		stock.description = brief.length > 200 ? brief.slice(0, 197) + '...' : brief;
	}

	stock.lastUpdated = new Date().toISOString();
	return true;
}

// Track successfully updated tickers for DCF step
const updatedTickers = new Set<string>();

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
	const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
	const allStocks = files.map((f) => {
		const path = resolve(DATA_DIR, f);
		return { path, stock: JSON.parse(readFileSync(path, 'utf-8')) };
	});

	// Filter to stocks that need updating
	const stale = allStocks.filter(({ stock }) => !isUpToDate(stock, FORCE));
	const upToDate = allStocks.length - stale.length;

	if (stale.length === 0) {
		console.log(
			`✅ All ${allStocks.length} stocks already updated today. Use --force to re-fetch.`
		);
		return;
	}
	if (upToDate > 0) {
		console.log(`ℹ️  ${upToDate} stocks already up to date, skipping.\n`);
	}
	console.log(`🔄 Updating ${stale.length} stocks from Yahoo Finance...\n`);

	// Stocks without a CAGR model just get a timestamp
	const noModel = stale.filter(({ stock }) => !stock.cagrModel);
	for (const { stock, path } of noModel) {
		stock.screener = { engine: 'N/A', signal: 'NO_DATA', note: 'No valuation model' };
		stock.lastUpdated = new Date().toISOString();
		atomicWriteJson(path, stock);
		console.log(`  ⏭  ${stock.ticker} — no model, timestamp updated`);
	}

	const withModel = stale.filter(({ stock }) => !!stock.cagrModel);
	if (withModel.length === 0) {
		console.log('\n✅ Done.');
		return;
	}

	// ── Step 1: Batch-fetch all quotes in ONE HTTP request ──
	const tickers = withModel.map(({ stock }) => yahooTicker(stock.ticker));
	console.log(`📡 Batch fetching quotes for ${tickers.length} tickers...`);
	let quotesObj: Record<string, any> = {};
	const maxRetries = 3;
	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			quotesObj = await fetchAllQuotes(tickers);
			if (Object.keys(quotesObj).length > 0) {
				console.log(`  ✅ Got ${Object.keys(quotesObj).length} quotes\n`);
				break;
			}
		} catch (error: any) {
			console.error(`  ❌ Batch quote attempt ${attempt} failed: ${error.message}`);
			if (attempt < maxRetries) {
				console.log(`  ⏳ Retrying in 5s...`);
				await sleep(5000);
			}
		}
	}

	// ── Step 2: Parallel quoteSummary in batches of CONCURRENCY ──
	let updated = 0;
	let failed = 0;

	for (let i = 0; i < withModel.length; i += CONCURRENCY) {
		const batch = withModel.slice(i, i + CONCURRENCY);
		const results = await Promise.allSettled(
			batch.map(async ({ stock, path }) => {
				const ticker = stock.ticker;
				const yTicker = yahooTicker(ticker);
				const quote = quotesObj[yTicker];

				if (!quote?.regularMarketPrice) {
					console.log(`  ⚠️  ${ticker} — no quote data`);
					return false;
				}

				const [summary, historicalData] = await Promise.all([
					fetchSummary(yTicker),
					fetchHistoricalData(yTicker)
				]);
				const ok = applyUpdates(stock, quote, summary, historicalData);

				if (ok) {
					atomicWriteJson(path, stock);
					updatedTickers.add(ticker);
					const s = stock.cagrModel?.scenarios;
					const scenarios =
						s?.bear && s?.base && s?.bull
							? `bear ${s.bear}, base ${s.base}, bull ${s.bull}`
							: 'no scenarios';
					const sc = stock.screener;
					const screenerTag =
						sc?.score == null
							? sc?.note
								? ` | ${sc.note}`
								: ''
							: ` | ${sc.engine}: ${sc.score} ${sc.signal}`;
					console.log(`  ✅ ${ticker}: ${stock.currentPrice} → ${scenarios}${screenerTag}`);
				} else {
					console.log(`  ⚠️  ${ticker} — update failed (no price)`);
				}
				return ok;
			})
		);

		for (const r of results) {
			if (r.status === 'fulfilled' && r.value) updated++;
			else failed++;
		}

		if (i + CONCURRENCY < withModel.length) await sleep(BATCH_DELAY_MS);
	}

	// ── Step 3: FMP DCF intrinsic values (only for stocks updated in this run) ──
	const tickersForDcf = [...updatedTickers];
	if (tickersForDcf.length > 0) {
		const { fetchAllDcf } = await import('./lib/fmp-client.js');
		const dcfMap = await fetchAllDcf(tickersForDcf);

		for (const { stock, path } of allStocks) {
			if (!updatedTickers.has(stock.ticker)) continue;
			const dcfData = dcfMap[stock.ticker];
			if (dcfData) {
				const price = parseDisplayPrice(stock.currentPrice);
				const discount = price != null && price > 0
					? +((dcfData.dcf - price) / price * 100).toFixed(0)
					: null;
				stock.intrinsicValue = {
					dcf: dcfData.dcf,
					date: dcfData.date,
					discount
				};
				atomicWriteJson(path, stock);
			}
		}
	}

	console.log(`\n✅ Done: ${updated} updated, ${failed} failed.`);
	console.log('   Run `pnpm build` to verify.');
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
