import { Page } from 'puppeteer';
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
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
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

			// Easiest reliable path: search all text nodes for numbers
			// that appear right next to the labels
			const textNodes: string[] = [];
			const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
			let n;
			while ((n = walk.nextNode())) {
				if (n.textContent) textNodes.push(n.textContent.trim());
			}

			// We need to find the text "Based on XX analysts" and look at the breakdown underneath
			// For now, let's just grep the text for e.g. "21 Strong Buy", or "Strong Buy = 5"
			const allText = textNodes.join(' ');

			for (const key of Object.keys(ratings)) {
				// Try to match "XX Strong Buy" or "Strong Buy = XX"
				const match1 = allText.match(new RegExp(`([0-9]+)\\s*${key}`, 'i'));
				const match2 = allText.match(new RegExp(`${key}\\s*(?:=|:)\\s*([0-9]+)`, 'i'));

				// Grab the largest number found for that label (since Barchart lists multiple timeframes,
				// the current/1 month ago are usually the most prominent blocks)
				let finalVal = 0;

				if (match1 && match1[1]) {
					const parsed = parseInt(match1[1], 10);
					if (!isNaN(parsed) && parsed > finalVal) finalVal = parsed;
				}
				if (match2 && match2[1]) {
					const parsed = parseInt(match2[1], 10);
					if (!isNaN(parsed) && parsed > finalVal) finalVal = parsed;
				}

				ratings[key] = finalVal;
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
