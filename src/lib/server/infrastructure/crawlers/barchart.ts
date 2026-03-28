import { type Page } from 'puppeteer';
import { getBrowser, randomDelay } from './browser';

export interface BarchartConsensus {
	ticker: string;
	strongBuy: number;
	moderateBuy: number;
	hold: number;
	moderateSell: number;
	strongSell: number;
}

/**
 * Scrapes Barchart for a given ticker's analyst rating consensus breakdown.
 */
export async function fetchBarchartConsensus(ticker: string): Promise<BarchartConsensus> {
	const url = `https://www.barchart.com/stocks/quotes/${ticker}/analyst-ratings`;
	const browser = await getBrowser();
	const page: Page = await browser.newPage();

	try {
		await page.setViewport({ width: 1366, height: 768 });

		// Barchart can take a moment to pass Incapsula
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
		await randomDelay(2000, 4000);

		// Hide the cookie banner if it obscures elements
		await page.evaluate(() => {
			const banner = document.querySelector('.qc-cmp2-container');
			if (banner) (banner as HTMLElement).style.display = 'none';
		});

		const result = await page.evaluate(() => {
			const ratings: Record<string, number> = {
				'Strong Buy': 0,
				'Moderate Buy': 0,
				Hold: 0,
				'Moderate Sell': 0,
				'Strong Sell': 0
			};

			// Query specific semantic structural containers to avoid full-page text parsing
			const elements = [...document.querySelectorAll('div, span, td, li, p, strong, h3')];
			for (const el of elements) {
				const text = el.textContent?.trim() || '';
				if (!text) continue;

				for (const key of Object.keys(ratings)) {
					// Try to match within this specific element or its immediate sibling
					const nodeStr = text + ' ' + (el.nextElementSibling?.textContent?.trim() ?? '');
					
					const match1 = new RegExp(String.raw`([0-9]+)\s*${key}`, 'i').exec(nodeStr);
					const match2 = new RegExp(String.raw`${key}\s*(?:=|:|-)?\s*([0-9]+)`, 'i').exec(nodeStr);

					let foundVal = 0;
					if (match1 && match1[1]) {
						const parsed = parseInt(match1[1], 10);
						if (!isNaN(parsed)) foundVal = parsed;
					}
					if (match2 && match2[1]) {
						const parsed = parseInt(match2[1], 10);
						if (!isNaN(parsed)) foundVal = parsed;
					}

					if (ratings[key] === undefined || foundVal > ratings[key]) {
						ratings[key] = foundVal;
					}
				}
			}

			return ratings;
		});

		return {
			ticker,
			strongBuy: result['Strong Buy'] ?? 0,
			moderateBuy: result['Moderate Buy'] ?? 0,
			hold: result['Hold'] ?? 0,
			moderateSell: result['Moderate Sell'] ?? 0,
			strongSell: result['Strong Sell'] ?? 0
		};
	} finally {
		await page.close();
	}
}
