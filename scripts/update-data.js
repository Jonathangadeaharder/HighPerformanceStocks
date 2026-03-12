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
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import YahooFinance from 'yahoo-finance2';

const yf = new YahooFinance({
	validation: { logErrors: false },
	suppressNotices: ['yahooSurvey', 'ripHistorical']
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'data', 'findings');
const HORIZON = 5;
const TERMINAL_GROWTH_PCT = 6; // nominal GDP — long-run EPS growth floor (McKinsey/Koller)
const GROWTH_DECAY = 0.8; // excess-growth half-life ~3 yrs (Chan, Karceski & Lakonishok 2003)
const CONCURRENCY = 5; // parallel quoteSummary requests per batch
const BATCH_DELAY_MS = 500; // pause between batches to avoid Yahoo rate limits
const FORCE = process.argv.includes('--force');

// US share class tickers use dots (BRK.B, HEI.A) but yahoo-finance2 needs dashes
const YAHOO_TICKER_MAP = { 'BRK.B': 'BRK-B', 'HEI.A': 'HEI-A', 'FIH.U.TO': 'FIH-U.TO' };
function yahooTicker(t) {
	return YAHOO_TICKER_MAP[t] || t;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

function todayISO() {
	return new Date().toISOString().slice(0, 10);
}

function isUpToDate(stock) {
	return !FORCE && stock.lastUpdated?.slice(0, 10) === todayISO();
}

function parsePercent(str) {
	if (!str) return null;
	const m = str.match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

function parseNumber(str) {
	if (str == null) return null;
	if (typeof str === 'number') return Number.isFinite(str) ? str : null;
	const m = String(str).match(/-?\d+(?:\.\d+)?/);
	return m ? parseFloat(m[0]) : null;
}

function fmtPct(n, decimals = 0) {
	if (n == null) return null;
	return `${n.toFixed(decimals)}%`;
}

function fmtRoundPct(n) {
	if (n == null) return null;
	return `${Math.round(n)}%`;
}

function fmtApproxPct(n) {
	if (n == null) return null;
	return `~${Math.round(n)}%`;
}

function fmtMultiple(n, decimals = 1) {
	if (n == null) return null;
	return `${n.toFixed(decimals)}x`;
}

/** Format price for display, handling GBp (pence → pounds) and other currencies. */
function fmtPrice(rawPrice, currency) {
	if (rawPrice == null) return null;
	if (currency === 'GBp' || currency === 'GBX') {
		return `£${(rawPrice / 100).toFixed(2)}`;
	}
	if (currency === 'SEK') return `${Math.round(rawPrice)} SEK`;
	if (currency === 'CAD') return `C$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
	if (currency === 'HKD') return `HK$${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
	const sym = { USD: '$', EUR: '€' }[currency] ?? `${currency} `;
	return `${sym}${rawPrice % 1 === 0 ? rawPrice : rawPrice.toFixed(2)}`;
}

/** Format market cap as e.g. "$12.3B USD", "C$54.4B", "€8.1B" */
function fmtMarketCap(rawCap, currency) {
	if (!rawCap) return null;
	const b = (rawCap / 1e9).toFixed(1);
	if (currency === 'GBp' || currency === 'GBX') return `£${(rawCap / 1e9).toFixed(1)}B`; // Yahoo normalises GBp market cap to £
	if (currency === 'SEK') return `${b}B SEK`;
	if (currency === 'CAD') return `C$${b}B`;
	if (currency === 'HKD') return `HK$${b}B`;
	const sym = { USD: '$', EUR: '€' }[currency] ?? `${currency} `;
	const suffix = currency === 'USD' ? ' USD' : '';
	return `${sym}${b}B${suffix}`;
}

/** CAGR calculation with exponential growth decay toward terminal rate.
 *  growth(yr) = terminal + (initial - terminal) * decay^yr
 *  Price and EPS must be in the same units (both pounds, both USD, etc.) */
function calcCAGR(
	price,
	ttmEPS,
	epsGrowthPct,
	exitPE,
	dividendYieldPct,
	horizon,
	decayFactor = GROWTH_DECAY
) {
	let eps = ttmEPS;
	for (let yr = 1; yr <= horizon; yr++) {
		const g =
			TERMINAL_GROWTH_PCT + (epsGrowthPct - TERMINAL_GROWTH_PCT) * Math.pow(decayFactor, yr);
		eps *= 1 + g / 100;
	}
	const futurePrice = eps * exitPE;
	const priceReturn = Math.pow(futurePrice / price, 1 / horizon) - 1;
	return (priceReturn + dividendYieldPct / 100) * 100;
}

// ─── Bifurcated Screener ─────────────────────────────────────────────────────
// Engine 1 (fPERG): growth > 8% — Agnostic Fundamental Risk-Adjusted Forward PEG
// Engine 2 (totalReturn): growth ≤ 8% — Risk-Adjusted Dividend + Growth

const GROWTH_ROUTING_THRESHOLD = 8;
const CV_BENCHMARK = 0.08;
const R2_NOISE = 0.6;
const FPERG_THRESHOLD = 1.0;
const TOTAL_RETURN_THRESHOLD = 12.0;
const DEBT_PENALTY_THRESHOLD = 150; // Yahoo reports D/E as percentage (150 = 1.5×)
const DEBT_PENALTY_FACTOR = 0.3;
const STABILIZATION_6M_THRESHOLD = -10;
const STABILIZATION_1M_THRESHOLD = 0;
const STABILIZATION_LOW_BUFFER = 1.05;

function getAnalystDispersion(earningsTrend) {
	if (!earningsTrend?.trend) return null;
	const entry = earningsTrend.trend.find((t) => t.period === '+1y');
	if (!entry?.earningsEstimate) return null;
	const { avg, low, high } = entry.earningsEstimate;
	if (avg == null || low == null || high == null || avg <= 0) return null;
	return { avg, low, high };
}

function computeGrowthScore(
	engine,
	multipleType,
	multiple,
	growthPct,
	cvStock,
	threshold = FPERG_THRESHOLD
) {
	const riskMultiplier = 1 + R2_NOISE * (cvStock - CV_BENCHMARK);
	const score = (multiple / growthPct) * riskMultiplier;
	return {
		engine,
		score: +score.toFixed(2),
		signal: score <= threshold ? 'PASS' : 'FAIL',
		inputs: {
			growth: growthPct,
			multipleType,
			multiple: +multiple.toFixed(1),
			cvStock: +cvStock.toFixed(3),
			riskMultiplier: +riskMultiplier.toFixed(3)
		}
	};
}

function detectGrowthBranch(stock, valuationPrice) {
	const basis = stock.cagrModel?.basis ?? '';
	const lowerBasis = basis.toLowerCase();
	const valuation = stock.valuation ?? {};
	const ttmBasis = stock.cagrModel?.ttmEPS;
	const priceToBasis = valuationPrice != null && ttmBasis > 0 ? valuationPrice / ttmBasis : null;

	if (/fee-related earnings|\bfre\b/.test(lowerBasis)) {
		return {
			engine: 'fFREG',
			multipleType: 'P/FRE',
			multiple: parseNumber(valuation.priceToFRE) ?? priceToBasis
		};
	}

	if (/adjusted net income|\bani\b|distributable earnings/.test(lowerBasis)) {
		return {
			engine: 'fANIG',
			multipleType: 'P/ANI',
			multiple: priceToBasis
		};
	}

	if (
		/price-to-fcf|price-to-cf|price-to-dcf|operating cfo|distributable cf|fcfa2s|cash flow/.test(
			lowerBasis
		)
	) {
		return {
			engine: 'fCFG',
			multipleType: valuation.evFcf != null ? 'EV/FCF' : 'P/CF',
			multiple: parseNumber(valuation.evFcf) ?? priceToBasis
		};
	}

	if (
		(/serial acquirer|amortization/.test(lowerBasis) || stock.group === 'Serial Acquirers') &&
		valuation.evEbitda != null &&
		valuation.evEbitda > 0
	) {
		return {
			engine: 'fEVG',
			multipleType: 'EV/EBITDA',
			multiple: valuation.evEbitda
		};
	}

	return {
		engine: 'fPERG',
		multipleType: 'Forward P/E',
		multiple: valuation.forwardPE
	};
}

function computeTotalReturn(growthPct, divYieldPct, forwardPE, debtToEquity) {
	const earningsYield = (1 / forwardPE) * 100;
	if (earningsYield <= divYieldPct) {
		return {
			engine: 'totalReturn',
			score: null,
			signal: 'FAIL',
			note: 'Dividend exceeds forward earnings (value trap)',
			inputs: {
				growth: growthPct,
				dividendYield: divYieldPct,
				earningsYield: +earningsYield.toFixed(1)
			}
		};
	}
	const hasPenalty = debtToEquity > DEBT_PENALTY_THRESHOLD;
	const baseReturn = divYieldPct + growthPct;
	const riskAdjReturn = hasPenalty ? baseReturn * (1 - DEBT_PENALTY_FACTOR) : baseReturn;
	return {
		engine: 'totalReturn',
		score: +riskAdjReturn.toFixed(1),
		signal: riskAdjReturn >= TOTAL_RETURN_THRESHOLD ? 'PASS' : 'FAIL',
		inputs: {
			growth: growthPct,
			dividendYield: divYieldPct,
			debtToEquity: +(debtToEquity ?? 0).toFixed(0),
			debtPenalty: hasPenalty
		}
	};
}

/** Post-PASS reality checks for fPERG stocks.
 *  RC1: Stabilization filter — reject only if weakness is ongoing and near fresh lows.
 *  RC2: Analyst revisions — detects actively collapsing consensus. */
function applyRealityChecks(result, rawPrice, historicalData, summary) {
	const checks = {};

	// Reality Check 1: Stabilization, not absolute momentum.
	const price6mAgo = historicalData?.price6mAgo;
	const price1mAgo = historicalData?.price1mAgo;
	const low3m = historicalData?.low3m;
	if (
		rawPrice != null &&
		price6mAgo != null &&
		price1mAgo != null &&
		low3m != null &&
		price6mAgo > 0 &&
		price1mAgo > 0 &&
		low3m > 0
	) {
		const return6m = (rawPrice / price6mAgo - 1) * 100;
		const return1m = (rawPrice / price1mAgo - 1) * 100;
		const near3mLow = rawPrice <= low3m * STABILIZATION_LOW_BUFFER;
		const stillFalling =
			return6m < STABILIZATION_6M_THRESHOLD && return1m < STABILIZATION_1M_THRESHOLD && near3mLow;
		checks.stabilization = {
			pass: !stillFalling,
			price: +rawPrice.toFixed(2),
			price6mAgo: +price6mAgo.toFixed(2),
			price1mAgo: +price1mAgo.toFixed(2),
			low3m: +low3m.toFixed(2),
			return6m: +return6m.toFixed(1),
			return1m: +return1m.toFixed(1),
			near3mLow
		};
		if (stillFalling) {
			result.signal = 'WAIT';
			result.note = 'Cheap, but still stabilizing (downtrend remains active)';
		}
	}

	// Reality Check 2: Analyst Revisions (from earningsTrend +1y epsRevisions)
	const entry = summary?.earningsTrend?.trend?.find((t) => t.period === '+1y');
	const rev = entry?.epsRevisions;
	const up = rev?.upLast30days ?? 0;
	const down = rev?.downLast30days ?? 0;
	const passed = !(down > 0 && up === 0);
	checks.revisions = { pass: passed, up30d: up, down30d: down };
	if (!passed) {
		result.signal = 'REJECTED';
		result.note = 'Consensus actively collapsing (analyst lag)';
	}

	result.realityChecks = checks;
}

function computeScreener(stock, summary, rawPrice, valuationPrice, historicalData) {
	const model = stock.cagrModel;
	const growthPct = parsePercent(model?.epsGrowth);
	if (growthPct == null) return { engine: 'N/A', signal: 'NO_DATA', note: 'Missing growth data' };

	const isPreProfit = model.exitPE && Object.values(model.exitPE).every((v) => v === 0);
	if (isPreProfit)
		return { engine: 'N/A', signal: 'NO_DATA', note: 'Pre-profit; screener not applicable' };

	if (growthPct > GROWTH_ROUTING_THRESHOLD) {
		const branch = detectGrowthBranch(stock, valuationPrice);
		if (!branch.multiple || branch.multiple <= 0) {
			return {
				engine: branch.engine,
				signal: 'NO_DATA',
				note: `Missing/negative ${branch.multipleType}`
			};
		}
		const dispersion = getAnalystDispersion(summary?.earningsTrend);
		if (!dispersion)
			return { engine: branch.engine, signal: 'NO_DATA', note: 'Missing analyst dispersion data' };
		const cvStock = (dispersion.high - dispersion.low) / 4 / dispersion.avg;
		const result = computeGrowthScore(
			branch.engine,
			branch.multipleType,
			branch.multiple,
			growthPct,
			cvStock
		);
		if (result.signal === 'PASS') {
			applyRealityChecks(result, rawPrice, historicalData, summary);
		}
		return result;
	}

	const forwardPE = stock.valuation?.forwardPE;
	if (!forwardPE || forwardPE <= 0)
		return { engine: 'totalReturn', signal: 'NO_DATA', note: 'Missing/negative forward PE' };
	const divYieldPct = parsePercent(model.dividendYield) || 0;
	const debtToEquity = summary?.financialData?.debtToEquity ?? 0;
	return computeTotalReturn(growthPct, divYieldPct, forwardPE, debtToEquity);
}

// ─── Fetch ───────────────────────────────────────────────────────────────────

/** Batch-fetch quotes for all tickers in a single HTTP call. */
async function fetchAllQuotes(tickers) {
	const result = {};
	const chunkSize = 20;
	for (let i = 0; i < tickers.length; i += chunkSize) {
		const chunk = tickers.slice(i, i + chunkSize);
		try {
			const res = await yf.quote(chunk, { return: 'object' });
			Object.assign(result, res);
		} catch (e) {
			console.error(`Chunk quote failed: ${e.message}`);
		}
		if (i + chunkSize < tickers.length) await new Promise((r) => setTimeout(r, 1000));
	}
	return result;
}

/** Fetch detailed summary modules per ticker (sequential, with caller-controlled delay). */
async function fetchSummary(ticker) {
	try {
		return await yf.quoteSummary(ticker, {
			modules: ['summaryDetail', 'defaultKeyStatistics', 'financialData', 'earningsTrend']
		});
	} catch {
		return {};
	}
}

/** Fetch 1yr daily prices → volatility + stabilization anchors. */
async function fetchHistoricalData(ticker) {
	try {
		const end = new Date();
		const start = new Date();
		start.setFullYear(start.getFullYear() - 1);

		const history = await yf.historical(ticker, {
			period1: start,
			period2: end,
			interval: '1d'
		});

		if (!history || history.length < 60)
			return { vol: null, price6mAgo: null, price1mAgo: null, low3m: null };

		// Historical anchors for stabilization detection
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		const entry6m = history.find((h) => new Date(h.date) >= sixMonthsAgo);
		const price6mAgo = entry6m?.close ?? null;
		const oneMonthAgo = new Date();
		oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
		const entry1m = history.find((h) => new Date(h.date) >= oneMonthAgo);
		const price1mAgo = entry1m?.close ?? null;
		const trailing3m = history.slice(-63);
		const low3m =
			trailing3m.length > 0
				? Math.min(...trailing3m.map((h) => h.low ?? h.close).filter((v) => v > 0))
				: null;

		const logReturns = [];
		for (let i = 1; i < history.length; i++) {
			const prev = history[i - 1].close;
			const curr = history[i].close;
			if (prev > 0 && curr > 0) {
				logReturns.push(Math.log(curr / prev));
			}
		}

		if (logReturns.length < 50) return { vol: null, price6mAgo, price1mAgo, low3m };

		const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
		const variance = logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);
		const vol = Math.round(Math.sqrt(variance) * Math.sqrt(252) * 100);

		return { vol, price6mAgo, price1mAgo, low3m };
	} catch {
		return { vol: null, price6mAgo: null, price1mAgo: null, low3m: null };
	}
}

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
		const decayFactor = typeof model.decayFactor === 'number' ? model.decayFactor : GROWTH_DECAY;

		if (epsGrowth != null && model.ttmEPS) {
			const scenarios = {};
			for (const [scenario, exitPE] of Object.entries(model.exitPE)) {
				const cagr = calcCAGR(
					priceForCalc,
					model.ttmEPS,
					epsGrowth,
					exitPE,
					dyPct,
					HORIZON,
					decayFactor
				);
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
	const stale = allStocks.filter(({ stock }) => !isUpToDate(stock));
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
