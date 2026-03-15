/**
 * update-data.js — Refresh all stock data from Yahoo Finance
 *
 * Dynamically updates:
 *   currentPrice, marketCap, valuation (PE/PEG/EV-EBITDA), metrics (ROE, FCF margin/yield,
 *   net debt/EBITDA, Rule of 40, gross/op margins), consensus.yahoo (analyst target),
 *   cagrModel (ttmEPS, epsGrowth via LTG estimate, dividendYield, scenarios), expectedCAGR
 *
 * Keeps manual:
 *   group, bullCase, bearCase, cagrModel.exitPE, cagrModel.basis, sharpeRatio,
 *   expectedVolatility, tipranks/stockanalysis consensus
 *
 * Usage:
 *   pnpm update-data           # skips stocks already updated today
 *   pnpm update-data --force   # re-fetches all regardless of lastUpdated
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import {
	DEFAULT_GROWTH_DECAY,
	DEFAULT_HORIZON,
	calcDecayedCagr,
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
const CONCURRENCY = 5; // parallel quoteSummary requests per batch
const BATCH_DELAY_MS = 500; // pause between batches to avoid Yahoo rate limits
const FORCE = process.argv.includes('--force');

// ─── Apply updates to one stock ─────────────────────────────────────────────

function applyUpdates(stock, quote, summary, historicalData) {
	const currency = quote.currency ?? 'USD';
	const rawPrice = quote.regularMarketPrice;
	if (!rawPrice) return false;

	const isGBp = currency === 'GBp' || currency === 'GBX';
	// For CAGR math, always work in "display" units (pounds for GBp, not pence)
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
	if (stock.valuation) {
		const pe = quote.trailingPE ?? sd.trailingPE;
		const fpe = quote.forwardPE ?? sd.forwardPE;
		const peg = ks.pegRatio;
		const evEbitda = ks.enterpriseToEbitda;

		if (pe != null) stock.valuation.trailingPE = +pe.toFixed(1);
		if (fpe != null) stock.valuation.forwardPE = +fpe.toFixed(1);
		if (peg != null) stock.valuation.pegRatio = +peg.toFixed(2);
		// Skip EV/EBITDA for alt-asset managers (consolidated insurance/real-estate balance sheets distort it)
		if (evEbitda != null && stock.valuation.evEbitda !== null) {
			stock.valuation.evEbitda = +evEbitda.toFixed(1);
		}
	}

	// ── metrics ──
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
		if (revGrowth != null && fcfMarginPct != null && stock.metrics.ruleOf40 !== undefined) {
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
		if (!stock.consensus) stock.consensus = {};
		stock.consensus.yahoo = fmtPrice(fd.targetMeanPrice, currency);
		stock.targetPrice = stock.consensus.yahoo;
	}

	// ── cagrModel ──
	const model = stock.cagrModel;
	if (model?.exitPE && model?.scenarios) {
		// TTM EPS — Yahoo returns EPS in the stock's major currency (£ for GBp stocks, not pence)
		// Skip for stocks using adjusted/normalized EPS (Yahoo returns GAAP; our model uses adjusted)
		const ttmEpsRaw = quote.epsTrailingTwelveMonths;
		if (ttmEpsRaw != null && ttmEpsRaw > 0) {
			const basis = model.basis ?? '';
			const isAdjusted = /adjusted|normalized|distributable|ANI|non-IFRS|CFO|FCFA2S/i.test(basis);
			if (!isAdjusted) {
				const newEps = Math.round(ttmEpsRaw * 100) / 100;
				// Sanity check: warn if change exceeds 50% (possible unit/currency bug)
				// With --force, update anyway (legitimate crashes e.g. MU downcycle can exceed 50%)
				if (model.ttmEPS && Math.abs(newEps - model.ttmEPS) / model.ttmEPS > 0.5) {
					if (FORCE) {
						console.log(
							`  ⚠️  ${stock.ticker} — ttmEPS change >50% (${model.ttmEPS} → ${newEps}), updating (--force)`
						);
						model.ttmEPS = newEps;
					} else {
						console.log(
							`  ⚠️  ${stock.ticker} — ttmEPS change >50% (${model.ttmEPS} → ${newEps}), skipping (run --force to override)`
						);
					}
				} else {
					model.ttmEPS = newEps;
				}
			}
		}

		// Dividend yield — skip for stocks with special/irregular dividends (Yahoo only reports regular)
		const hasSpecialDividends = /special dividend/i.test(model.basis ?? '');
		if (!hasSpecialDividends) {
			const rawDy = sd.dividendYield ?? quote.trailingAnnualDividendYield;
			if (rawDy != null) model.dividendYield = fmtRoundPct(rawDy * 100);
		}

		// epsGrowth is kept manual — no reliable per-stock LTG source in Yahoo Finance

		// Recalculate scenarios
		const epsGrowth = parsePercent(model.epsGrowth);
		const dyPct = parsePercent(model.dividendYield) || 0;
		const decayFactor =
			typeof model.decayFactor === 'number' ? model.decayFactor : DEFAULT_GROWTH_DECAY;

		if (epsGrowth != null && model.ttmEPS) {
			const scenarios = {};
			for (const [scenario, exitPE] of Object.entries(model.exitPE)) {
				const cagr = calcDecayedCagr({
					price: priceForCalc,
					ttmEPS: model.ttmEPS,
					epsGrowthPct: epsGrowth,
					exitPE,
					dividendYieldPct: dyPct,
					horizon: DEFAULT_HORIZON,
					decayFactor
				});
				scenarios[scenario] = fmtRoundPct(cagr);
			}
			model.scenarios = scenarios;

			const bear = parsePercent(scenarios.bear);
			const bull = parsePercent(scenarios.bull);
			if (bear != null && bull != null) {
				stock.expectedCAGR = `${bear}% - ${bull}%`;
			}
		}
	}

	// ── Realized volatility (1yr annualized) ──
	const realizedVol = historicalData?.vol;
	if (realizedVol != null) {
		stock.expectedVolatility = `~${realizedVol}%`;
	}

	// ── Sharpe ratio (derived: midpoint CAGR over risk-free, divided by volatility) ──
	const vol = parsePercent(stock.expectedVolatility);
	if (vol != null && vol > 0 && stock.cagrModel?.scenarios) {
		const bearS = parsePercent(stock.cagrModel.scenarios.bear);
		const bullS = parsePercent(stock.cagrModel.scenarios.bull);
		if (bearS != null && bullS != null) {
			const midCagr = (bearS + bullS) / 2;
			const RISK_FREE = 4.5;
			stock.sharpeRatio = +((midCagr - RISK_FREE) / vol).toFixed(2);
		}
	}

	// ── Bifurcated screener (fPERG / Total Return) ──
	stock.screener = computeScreener(stock, summary, rawPrice, priceForCalc, historicalData);

	stock.lastUpdated = new Date().toISOString();
	return true;
}

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

	// Stocks without a CAGR model (e.g. RXRX) just get a timestamp
	const noModel = stale.filter(({ stock }) => !stock.cagrModel?.exitPE);
	for (const { stock, path } of noModel) {
		stock.screener = { engine: 'N/A', signal: 'NO_DATA', note: 'No valuation model' };
		stock.lastUpdated = new Date().toISOString();
		writeFileSync(path, JSON.stringify(stock, null, '\t') + '\n');
		console.log(`  ⏭  ${stock.ticker} — no CAGR model, timestamp updated`);
	}

	const withModel = stale.filter(({ stock }) => !!stock.cagrModel?.exitPE);
	if (withModel.length === 0) {
		console.log('\n✅ Done.');
		return;
	}

	// ── Step 1: Batch-fetch all quotes in ONE HTTP request ──
	const tickers = withModel.map(({ stock }) => yahooTicker(stock.ticker));
	console.log(`📡 Batch fetching quotes for ${tickers.length} tickers...`);
	let quotesObj = {};
	try {
		quotesObj = await fetchAllQuotes(tickers);
		console.log(`  ✅ Got ${Object.keys(quotesObj).length} quotes\n`);
	} catch (err) {
		console.error(`  ❌ Batch quote failed: ${err.message}\n`);
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
					writeFileSync(path, JSON.stringify(stock, null, '\t') + '\n');
					const s = stock.cagrModel?.scenarios;
					const scenarios =
						s?.bear && s?.base && s?.bull
							? `bear ${s.bear}, base ${s.base}, bull ${s.bull}`
							: 'no scenarios';
					const sc = stock.screener;
					const screenerTag =
						sc?.score != null
							? ` | ${sc.engine}: ${sc.score} ${sc.signal}`
							: sc?.note
								? ` | ${sc.note}`
								: '';
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

	console.log(`\n✅ Done: ${updated} updated, ${failed} failed.`);
	console.log('   Run `pnpm build` to verify.');
}

main().catch((err) => {
	console.error('Fatal error:', err);
	process.exit(1);
});
