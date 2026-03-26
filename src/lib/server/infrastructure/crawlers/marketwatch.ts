import { Page } from 'puppeteer';
import { getBrowser, randomDelay } from './browser';

export interface MarketWatchIndex {
	symbol: string;
	price: number | null;
	marketTime: string | null;
}

/**
 * Scrapes MarketWatch.com for a given index's live price and last updated time.
 */
export async function fetchMarketWatchIndex(
	symbol: string,
	urlPath: string
): Promise<MarketWatchIndex> {
	const url = `https://www.marketwatch.com/investing/index/${urlPath}`;
	const browser = await getBrowser();
	const page: Page = await browser.newPage();

	try {
		// Mimic realistic browsing behavior
		await page.setViewport({ width: 1366, height: 768 });

		// MarketWatch can be slow; use domcontentloaded to get the critical HTML as fast as possible
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
		await randomDelay(1000, 2000);

		const result = await page.evaluate(() => {
			const priceEl = document.querySelector('.intraday__price bg-quote, h2.intraday__price');
			const timeEl = document.querySelector('.intraday__timestamp span.timestamp__time');

			let price: number | null = null;
			let time: string | null = null;

			if (priceEl && priceEl.textContent) {
				const priceStr = priceEl.textContent.trim().replace(/,/g, '');
				const parsed = parseFloat(priceStr);
				if (!isNaN(parsed)) price = parsed;
			}

			if (timeEl && timeEl.textContent) {
				time = timeEl.textContent.trim();
			}

			return { price, time };
		});

		// Parse the MarketWatch timestamp (e.g., "Last Updated: Mar 25, 2026 3:15 p.m.  CDT")
		// Note: The time parsing here is tricky because it has a timezone code.
		// For our volatility index purposes, if the day is from the current or previous day, it's fresh enough.
		// We'll return the raw string to let the caller handle freshness, or try to parse it to ISO.
		let isoTime: string | null = null;
		if (result.time) {
			// Very rough extraction of just the date part, e.g. "Mar 25, 2026"
			const dateMatch = result.time.match(/([a-zA-Z]{3} \d{1,2}, \d{4})/i);
			if (dateMatch && dateMatch[1]) {
				const d = new Date(dateMatch[1]);
				if (!isNaN(d.getTime())) {
					isoTime = d.toISOString();
				}
			}
		}

		return {
			symbol,
			price: result.price,
			marketTime: isoTime
		};
	} catch (e: any) {
		console.error(`MarketWatch crawler failed for ${symbol}: ${e.message}`);
		return {
			symbol,
			price: null,
			marketTime: null
		};
	} finally {
		await page.close();
	}
}
