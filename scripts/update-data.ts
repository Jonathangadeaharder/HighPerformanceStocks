/* eslint-disable max-depth, sonarjs/todo-tag */
import 'dotenv/config';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { STOCK_RECORDS_DIR } from '../src/lib/server/infrastructure/paths.js';
import { isUpToDate, sleep } from './lib/display-formatters.js';
import {
	fetchAllQuotes,
	fetchHistoricalData,
	fetchSummary,
	yahooTicker
} from './lib/yahoo-client.js';
import { parseDisplayPrice } from '../src/lib/domain/finance/core.js';
import { atomicWriteJson } from './lib/update/fs.js';
import { applyUpdates } from './lib/update/apply.js';

const DATA_DIR = STOCK_RECORDS_DIR;
const CONCURRENCY = 5;
const BATCH_DELAY_MS = 500;
const FORCE = process.argv.includes('--force');

const updatedTickers = new Set<string>();

async function main() {
	const files = readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'));
	const allStocks = files.map((f) => {
		const path = resolve(DATA_DIR, f);
		return { path, stock: JSON.parse(readFileSync(path, 'utf-8')) };
	});

	const stale = allStocks.filter(({ stock }) => !isUpToDate(stock, FORCE));
	const upToDate = allStocks.length - stale.length;

	if (stale.length === 0) {
		console.log(`✅ All ${allStocks.length} stocks up to date. Use --force to re-fetch.`);
		return;
	}
	if (upToDate > 0) {
		console.log(`ℹ️  ${upToDate} stocks already up to date, skipping.\n`);
	}
	console.log(`🔄 Updating ${stale.length} stocks from Yahoo Finance...\n`);

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

	let updatedCount = 0;
	let failedCount = 0;

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
				const ok = applyUpdates(stock, quote, summary, historicalData, FORCE);

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
					console.log(`  ⚠️  ${ticker} — update failed`);
				}
				return ok;
			})
		);

		for (const r of results) {
			if (r.status === 'fulfilled' && r.value) updatedCount++;
			else failedCount++;
		}

		if (i + CONCURRENCY < withModel.length) await sleep(BATCH_DELAY_MS);
	}

	const tickersForDcf = [...updatedTickers];
	if (tickersForDcf.length > 0) {
		const { fetchAllDcf } = await import('./lib/fmp-client.js');
		const { fetchBarchartConsensus } =
			await import('../src/lib/server/infrastructure/crawlers/barchart.js');
		const { fetchMarketBeatTarget } =
			await import('../src/lib/server/infrastructure/crawlers/marketbeat.js');
		const { getBrowser, closeBrowser } =
			await import('../src/lib/server/infrastructure/crawlers/browser.js');

		console.log(`📡 Fetching DCF and analyst data for ${tickersForDcf.length} tickers...`);

		// Initialize the browser once for all crawler work
		await getBrowser();

		const dcfMap = await fetchAllDcf(tickersForDcf);

		for (const entry of allStocks) {
			if (!entry) continue;
			const { stock, path } = entry;
			if (!updatedTickers.has(stock.ticker)) continue;

			const dcfData = dcfMap[stock.ticker];
			if (dcfData) {
				const price = parseDisplayPrice(stock.currentPrice);
				const discount =
					price != null && price > 0 ? +(((dcfData.dcf - price) / price) * 100).toFixed(0) : null;
				stock.intrinsicValue = {
					dcf: dcfData.dcf,
					date: dcfData.date,
					discount
				};
			}

			// Add polite delays so we don't get IP banned
			console.log(`  🕸️  Crawling alternative analyst data for ${stock.ticker}...`);
			try {
				const [barchartData, marketBeatData] = await Promise.all([
					fetchBarchartConsensus(stock.ticker),
					fetchMarketBeatTarget('NASDAQ', stock.ticker) // TODO: map exchange correctly or remove exchange dependency
				]);

				if (barchartData) {
					stock.analystConsensus = barchartData;
				}

				if (marketBeatData) {
					if (marketBeatData.consensusTarget) {
						stock.targetPriceAlternative = `$${marketBeatData.consensusTarget.toFixed(2)}`;
					}
					if (marketBeatData.consensusRating) {
						stock.consensusRating = marketBeatData.consensusRating;
					}
				}
			} catch (error: any) {
				console.log(`  ⚠️  Crawler failed for ${stock.ticker}: ${error.message}`);
			}

			atomicWriteJson(path, stock);
		}

		await closeBrowser();
	}

	console.log(`\n✅ Done: ${updatedCount} updated, ${failedCount} failed.`);
}

main().catch((error: unknown) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
