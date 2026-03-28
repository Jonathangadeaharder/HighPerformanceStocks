import { type Page } from 'puppeteer';
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
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
		await randomDelay(1000, 2000);

		const result = await page.evaluate(() => {
			const priceEl = document.querySelector('.intraday__price bg-quote, h2.intraday__price');
			const timeEl = document.querySelector('.intraday__timestamp span.timestamp__time');
			const timeMeta = document.querySelector('time[datetime], mw-time[data-timestamp], [data-est]') as HTMLElement | null;

			let price: number | null = null;
			let time: string | null = null;
			let isoTimeRaw: string | null = null;

			if (priceEl && priceEl.textContent) {
				const priceStr = priceEl.textContent.trim().replaceAll(',', '');
				const parsed = parseFloat(priceStr);
				if (!isNaN(parsed)) price = parsed;
			}

			if (timeMeta) {
				isoTimeRaw = timeMeta.getAttribute('datetime') || timeMeta.dataset.timestamp || timeMeta.dataset.est || null;
			}

			if (timeEl && timeEl.textContent) {
				time = timeEl.textContent.trim();
			}

			return { price, time, isoTimeRaw };
		});

		let isoTime: string | null = null;

		// 1. Prioritize machine-readable metadata if available
		if (result.isoTimeRaw) {
			const unix = parseInt(result.isoTimeRaw, 10);
			if (!isNaN(unix) && unix > 1_000_000_000) {
				// Convert seconds to ms if necessary
				isoTime = new Date(unix * (unix < 1_000_000_000_000 ? 1000 : 1)).toISOString();
			} else {
				const d = new Date(result.isoTimeRaw);
				if (!isNaN(d.getTime())) isoTime = d.toISOString();
			}
		}

		// 2. Fallback to rough regex extraction if machine-readable attribute was missing
		if (!isoTime && result.time) {
			const dateMatch = /([a-z]{3} \d{1,2}, \d{4})/i.exec(result.time);
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
	} catch (error: unknown) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`MarketWatch crawler failed for ${symbol}: ${errorMessage}`);
		return {
			symbol,
			price: null,
			marketTime: null
		};
	} finally {
		await page.close();
	}
}
