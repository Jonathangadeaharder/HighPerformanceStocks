import { calcForwardScenarios, parsePercent } from '../../../src/lib/domain/finance/core';
import {
	fmtApproxPct,
	fmtMarketCap,
	fmtMultiple,
	fmtPct,
	fmtPrice,
	fmtRoundPct
} from '../display-formatters';
import { computeScreener } from '../../../src/lib/domain/screener/engine';
import { computeQCS } from './qcs';

/**
 * Apply Yahoo Finance updates to a stock record.
 */
export function applyUpdates(
	stock: any,
	quote: any,
	summary: any,
	historicalData: any,
	force = false
) {
	const currency = quote.currency;
	if (!currency) {
		console.log(`  ⚠️  ${stock.ticker} — missing currency field, skipping`);
		return false;
	}
	const rawPrice = quote.regularMarketPrice;
	if (!rawPrice) return false;

	const isGBp = currency === 'GBp' || currency === 'GBX';
	const priceForCalc = isGBp ? rawPrice / 100 : rawPrice;

	const sd = summary?.summaryDetail ?? {};
	const ks = summary?.defaultKeyStatistics ?? {};
	const fd = summary?.financialData ?? {};

	stock.currentPrice = fmtPrice(rawPrice, currency);

	const rawCap = quote.marketCap ?? sd.marketCap;
	if (rawCap) stock.marketCap = fmtMarketCap(rawCap, currency);

	computeValuation(stock, quote, sd, ks, fd, rawCap);
	updateMetrics(stock, fd, rawCap, sd, ks);

	function computeValuation(
		stock: any,
		quote: any,
		sd: any,
		ks: any,
		fd: any,
		rawCap: number | undefined
	) {
		if (!stock.valuation) stock.valuation = {};
		const pe = quote.trailingPE ?? sd.trailingPE;
		const fpe = quote.forwardPE ?? sd.forwardPE;
		const peg = ks.pegRatio;
		let evEbitda = ks.enterpriseToEbitda;
		let evFcf: number | null = null;

		const totalDebt = fd.totalDebt;
		const totalCash = fd.totalCash;
		const ebitda = fd.ebitda;
		const fcf = fd.freeCashflow;

		if (ks.enterpriseValue && rawCap && totalDebt != null && totalCash != null && ebitda) {
			const calcEv = rawCap + totalDebt - totalCash;
			if (calcEv / ks.enterpriseValue > 2) {
				console.log(`  🚨  ${stock.ticker} — Yahoo EV corrupted. Overriding EV multiples.`);
				evEbitda = calcEv / ebitda;
				if (fcf != null && Math.abs(fcf) > 0) evFcf = calcEv / fcf;
			} else if (fcf != null && Math.abs(fcf) > 0) {
				evFcf = ks.enterpriseValue / fcf;
			}
		} else if (ks.enterpriseValue && fcf != null && Math.abs(fcf) > 0) {
			evFcf = ks.enterpriseValue / fcf;
		}

		if (pe != null) stock.valuation.trailingPE = +pe.toFixed(1);
		if (fpe != null) stock.valuation.forwardPE = +fpe.toFixed(1);
		if (peg != null) stock.valuation.pegRatio = +peg.toFixed(2);
		if (evFcf != null) stock.valuation.evFcf = +evFcf.toFixed(1);

		if (evEbitda != null && stock.valuation.evEbitda !== null) {
			const isMegaCap = rawCap && rawCap > 50_000_000_000;
			if (isMegaCap && evEbitda < 5) {
				console.log(`  ⚠️  ${stock.ticker} — anomalous EV/EBITDA mega-cap rejection`);
				stock.valuation.evEbitda = null;
			} else {
				stock.valuation.evEbitda = +evEbitda.toFixed(1);
			}
		}
	}

	function updateMetrics(stock: any, fd: any, rawCap: number | undefined, sd: any, ks: any) {
		if (!stock.metrics) stock.metrics = {};
		const roe = fd.returnOnEquity;
		if (roe != null) stock.metrics.roe = fmtPct(roe * 100, 1);

		const fcf = fd.freeCashflow;
		const rev = fd.totalRevenue;
		const fcfMarginPct = fcf != null && rev != null && rev > 0 ? (fcf / rev) * 100 : null;
		if (fcfMarginPct != null) stock.metrics.fcfMargin = fmtApproxPct(fcfMarginPct);

		if (fcf != null && rawCap != null && rawCap > 0) {
			const fcfYieldPct = (fcf / rawCap) * 100;
			stock.metrics.fcfYield = `~${Math.round(fcfYieldPct)}%`;
		}

		const totalDebt = fd.totalDebt;
		const totalCash = fd.totalCash;
		const ebitda = fd.ebitda;
		const isNM = /^N\/M/i.test(stock.metrics.netDebtEbitda ?? '');
		if (!isNM && totalDebt != null && totalCash != null && ebitda != null && Math.abs(ebitda) > 0) {
			const netDebt = totalDebt - totalCash;
			stock.metrics.netDebtEbitda = netDebt < 0 ? 'Net cash' : fmtMultiple(netDebt / ebitda);
		}

		const revGrowth = fd.revenueGrowth;
		if (revGrowth != null && fcfMarginPct != null) {
			stock.metrics.ruleOf40 = fmtRoundPct(revGrowth * 100 + fcfMarginPct);
		}

		if (stock.metrics.grossMargin !== undefined && fd.grossMargins != null) {
			stock.metrics.grossMargin = fmtPct(fd.grossMargins * 100, 2);
		}
		if (stock.metrics.operatingMargin !== undefined && fd.operatingMargins != null) {
			stock.metrics.operatingMargin = fmtApproxPct(fd.operatingMargins * 100);
		}
		if (stock.metrics.ebitdaMargin !== undefined && fd.ebitdaMargins != null) {
			stock.metrics.ebitdaMargin = fmtApproxPct(fd.ebitdaMargins * 100);
		}

		// --- Phase 2: Always populate beta (required by Component 5: beta-adaptive momentum) ---
		const betaRaw = sd.beta ?? ks.beta;
		if (betaRaw != null) {
			stock.metrics.beta = String(+betaRaw.toFixed(2));
		}

		// --- Phase 2: Always populate revenueGrowth ---
		if (revGrowth != null) {
			stock.metrics.revenueGrowth = fmtPct(revGrowth * 100, 1);
		}

		// --- Phase 2: Compute ROIC (required by Component 3: ROIC-adjusted PEG ceilings) ---
		// ROIC ≈ NOPAT / Invested Capital
		// NOPAT ≈ operatingCashflow (as proxy since net income + interest is not directly available)
		// Invested Capital ≈ totalDebt + marketCap - totalCash (total capital deployed)
		// More precisely: ROIC = Operating Income * (1 - tax rate) / (Total Equity + Total Debt - Cash)
		// We approximate using: operatingCashflow / (marketCap + totalDebt - totalCash)
		const opCashflow = fd.operatingCashflow;
		if (opCashflow != null && rawCap != null && rawCap > 0 && totalDebt != null && totalCash != null) {
			const investedCapital = rawCap + totalDebt - totalCash;
			if (investedCapital > 0) {
				const roicPct = (opCashflow / investedCapital) * 100;
				stock.metrics.roic = fmtPct(roicPct, 1);
			}
		}

		// --- Phase 2: Compute Interest Coverage Ratio (future upgrade for Component 4 leverage sigmoid) ---
		// ICR = EBITDA / Interest Expense
		// Yahoo's financialData doesn't provide interestExpense directly,
		// but we can derive it from: debtToEquity and totalDebt patterns.
		// For now: if EBITDA and totalDebt are available, approximate:
		// interestExpense ≈ totalDebt * assumed_rate (5.5% blended corp rate)
		// This is imperfect but directionally correct and self-consistent.
		if (ebitda != null && ebitda > 0 && totalDebt != null && totalDebt > 0) {
			const assumedRate = 0.055;
			const estInterest = totalDebt * assumedRate;
			if (estInterest > 0) {
				const icr = ebitda / estInterest;
				stock.metrics.interestCoverage = fmtMultiple(icr);
			}
		} else if (ebitda != null && ebitda > 0 && (totalDebt == null || totalDebt <= 0)) {
			// No debt → infinite coverage, represented as high value
			stock.metrics.interestCoverage = '>50x';
		}
	}

	if (fd.targetMeanPrice != null) {
		const isAnomalous = fd.targetMeanPrice > rawPrice * 3 || fd.targetMeanPrice < rawPrice * 0.5;
		if (!isAnomalous) {
			if (!stock.consensus) stock.consensus = {};
			stock.consensus.yahoo = fmtPrice(fd.targetMeanPrice, currency);
			stock.targetPrice = stock.consensus.yahoo;
		}
	}

	if (fd.targetLowPrice != null && fd.targetMeanPrice != null && fd.targetHighPrice != null) {
		const isAnomalous = fd.targetMeanPrice > rawPrice * 3 || fd.targetMeanPrice < rawPrice * 0.5;
		const isSingleAnalyst =
			fd.targetLowPrice === fd.targetMeanPrice && fd.targetMeanPrice === fd.targetHighPrice;
		if (!isAnomalous && !isSingleAnalyst) {
			const divisor = isGBp ? 100 : 1;
			stock.analystTargets = {
				low: +(fd.targetLowPrice / divisor).toFixed(2),
				mean: +(fd.targetMeanPrice / divisor).toFixed(2),
				high: +(fd.targetHighPrice / divisor).toFixed(2)
			};
		} else if (isSingleAnalyst) {
			delete stock.analystTargets;
			if (stock.consensus) delete stock.consensus.yahoo;
			delete stock.targetPrice;
		}
	}

	// --- Populate forwardEstimates from Yahoo earningsTrend (0y, +1y) ---
	const earningsTrend = (summary as any)?.earningsTrend?.trend;
	if (earningsTrend && Array.isArray(earningsTrend)) {
		const currentYear = earningsTrend.find((t: any) => t.period === '0y');
		const nextYear = earningsTrend.find((t: any) => t.period === '+1y');

		const cyEst = currentYear?.earningsEstimate;
		const nyEst = nextYear?.earningsEstimate;
		if (cyEst?.avg != null && nyEst?.avg != null) {
			const cyYear = new Date(currentYear.endDate).getFullYear();
			const nyYear = new Date(nextYear.endDate).getFullYear();

			// Validate dates and guard against both periods landing in the same year
			if (Number.isFinite(cyYear) && Number.isFinite(nyYear) && cyYear !== nyYear) {
				stock.forwardEstimates = {
					[String(cyYear)]: { high: cyEst.high, low: cyEst.low, average: cyEst.avg },
					[String(nyYear)]: { high: nyEst.high, low: nyEst.low, average: nyEst.avg }
				};
			}
		}
	}

	const model = stock.cagrModel;
	if (model) {
		if (model.epsGrowthSource === 'auto' || (!model.epsGrowth && !model.epsGrowthSource)) {
			// Multi-year CAGR from forwardEstimates (analyst consensus)
			// No artificial cap — analyst estimates determine what is realistic.
			const fwdEst = stock.forwardEstimates;
			if (fwdEst && typeof fwdEst === 'object') {
				const years = Object.keys(fwdEst)
					.filter((y) => /^\d{4}$/.test(y))
					.sort();
				if (years.length >= 2) {
					const firstYearKey = years[0]!;
					const lastYearKey = years[years.length - 1]!;
					const firstYear = fwdEst[firstYearKey];
					const lastYear = fwdEst[lastYearKey];
					if (firstYear?.average > 0 && lastYear?.average > 0) {
						const n = years.length - 1;
						const cagr = (Math.pow(lastYear.average / firstYear.average, 1 / n) - 1) * 100;
						model.epsGrowth = `${Math.round(cagr)}%`;
						model.epsGrowthSource = 'auto';
					} else {
						console.warn(`  ⚠️  ${stock.ticker}: forwardEstimates present but averages invalid (first=${firstYear?.average}, last=${lastYear?.average})`);
					}
				} else {
					console.warn(`  ⚠️  ${stock.ticker}: forwardEstimates present but only ${years.length} year(s) — need >=2`);
				}
			} else {
				console.warn(`  ⚠️  ${stock.ticker}: NO forwardEstimates — no earningsTrend data available`);
			}
		}

		let ttmEpsRaw = quote.epsTrailingTwelveMonths;

		if (stock.group?.includes('Alt Assets') || /FRE|Distributable/i.test(model.basis ?? '')) {
			const currentYearTrend = summary?.earningsTrend?.trend?.find((t: any) => t.period === '0y');
			if (currentYearTrend?.earningsEstimate?.avg) {
				ttmEpsRaw = currentYearTrend.earningsEstimate.avg;
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
				if (model.ttmEPS && Math.abs(newEps - model.ttmEPS) / model.ttmEPS > 0.5 && !force) {
					return false;
				}
				model.ttmEPS = newEps;
			}
		}

		const hasSpecialDividends = /special dividend/i.test(model.basis ?? '');
		if (!hasSpecialDividends) {
			const rawDy = sd.dividendYield ?? quote.trailingAnnualDividendYield;
			if (rawDy != null) {
				const dyPct = rawDy * 100;
				if (dyPct <= 25) {
					model.dividendYield = fmtRoundPct(dyPct);
				}
			}
		}

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
			delete model.scenarios;
			delete stock.expectedCAGR;
		}
	}

	const realizedVol = historicalData?.vol;
	if (realizedVol != null) {
		stock.expectedVolatility = `~${realizedVol}%`;
	}

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

	stock.screener = computeScreener(stock, summary, rawPrice, priceForCalc, historicalData);

	const cvStock = stock.screener?.inputs?.cvStock || 0.08;
	const qcsData = computeQCS(summary, cvStock);
	if (qcsData) {
		stock.qcs = qcsData;
		
		const qcsScore = qcsData.totalScore;
		if (qcsScore >= 10) stock.confidence = 'high';
		else if (qcsScore >= 5) stock.confidence = 'medium';
		else if (qcsScore >= 0) stock.confidence = 'low';
		else stock.confidence = 'cut';
	}

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
