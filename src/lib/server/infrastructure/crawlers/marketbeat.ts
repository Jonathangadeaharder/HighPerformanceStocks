import { type Page } from 'puppeteer';
import { getBrowser, randomDelay } from './browser';

export interface MarketBeatStockTarget {
	ticker: string;
	currentPrice: number | null;
	consensusTarget: number | null;
	upside: number | null;
	consensusRating?: string;
}

/**
 * Scrapes MarketBeat.com for a given ticker's price target and consensus rating.
 */
export async function fetchMarketBeatTarget(
	exchange: string,
	ticker: string
): Promise<MarketBeatStockTarget> {
	const url = `https://www.marketbeat.com/stocks/${exchange}/${ticker}/price-target/`;
	const browser = await getBrowser();
	const page: Page = await browser.newPage();

	try {
		// Mimic realistic browsing behavior
		await page.setViewport({ width: 1366, height: 768 });
		await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });

		// Wait randomly to prevent instant parsing detection
		await randomDelay(1000, 3000);

		const result = await page.evaluate(() => {
			const data = {
				consensusRating: '',
				consensusTarget: 0,
				upside: 0
			};

			// Easiest reliable path: search all text nodes for the string "Consensus Price Target"
			// and then grab the number immediately following it.
			const textNodes: string[] = [];
			const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
			let n;
			while ((n = walk.nextNode())) {
				if (n.textContent) textNodes.push(n.textContent.trim());
			}

			// We need to find the index where it says "Consensus Price Target"
			const allText = textNodes.join(' ');

			// 1. Target Price ("Consensus Price Target $297.58")
			const targetMatch = /Consensus Price Target\s*\$?([0-9,.]+)/i.exec(allText);
			if (targetMatch && targetMatch[1]) {
				data.consensusTarget = parseFloat(targetMatch[1].replaceAll(',', ''));
			}

			// 2. Upside ("Forecasted Upside 17.80% Upside")
			const upsideMatch =
				/Forecasted Upside\s*[\u2191\u2193]?([0-9.]+)%\s*Upside/i.exec(allText) ||
				/Forecasted Upside\s*[\u2191\u2193]?([0-9.]+)%\s*Downside/i.exec(allText);
			if (upsideMatch && upsideMatch[1]) {
				const val = parseFloat(upsideMatch[1]);
				data.upside = /Forecasted Upside\s*[\u2191\u2193]?([0-9.]+)%\s*Downside/i.test(allText) ? -val : val;
			}

			// 3. Consensus Rating ("Consensus Rating Moderate Buy")
			const ratingMatch = /Consensus Rating\s*(Moderate Buy|Strong Buy|Hold|Moderate Sell|Strong Sell)/i.exec(allText);
			if (ratingMatch && ratingMatch[1]) {
				data.consensusRating = ratingMatch[1].trim();
			}

			return data;
		});

		return {
			ticker,
			currentPrice: null, // Removed currentPrice since we don't strictly need it and we don't have it in the new extraction method
			consensusRating: result.consensusRating || 'Unknown',
			consensusTarget: result.consensusTarget,
			upside: result.upside ? +result.upside.toFixed(2) : null
		};
	} finally {
		await page.close();
	}
}
