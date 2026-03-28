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
			const data: { consensusRating: string | null; consensusTarget: number | null; upside: number | null } = {
				consensusRating: null,
				consensusTarget: null,
				upside: null
			};

			// Query specific semantic structural containers to avoid full-page text parsing
			const elements = [...document.querySelectorAll('td, th, span, div, p, strong')];
			for (const el of elements) {
				const text = el.textContent?.trim() || '';
				if (!text) continue;

				if (data.consensusTarget === null && text.includes('Consensus Price Target')) {
					// Check the element itself or its nextElementSibling
					const match = /^\$?([0-9,.]+)$/.exec(el.nextElementSibling?.textContent?.trim() || '') 
						|| /Consensus Price Target\s*\$?([0-9,.]+)/i.exec(text);
					if (match && match[1]) {
						const parsed = parseFloat(match[1].replace(',', ''));
						if (Number.isFinite(parsed)) data.consensusTarget = parsed;
					}
				}

				if (data.upside === null && text.includes('Forecasted Upside')) {
					const nodeStr = text + ' ' + (el.nextElementSibling?.textContent ?? '');
					const upMatch = /[\u2191\u2193]?(\d{1,10}(?:\.\d{1,4})?)%\s{0,10}Upside/i.exec(nodeStr);
					const dnMatch = /[\u2191\u2193]?(\d{1,10}(?:\.\d{1,4})?)%\s{0,10}Downside/i.exec(nodeStr);
					if (upMatch && upMatch[1]) data.upside = parseFloat(upMatch[1]);
					if (dnMatch && dnMatch[1]) data.upside = -parseFloat(dnMatch[1]);
				}

				if (data.consensusRating === null && text.includes('Consensus Rating')) {
					const nodeStr = text + ' ' + (el.nextElementSibling?.textContent ?? '');
					const match = /(Moderate Buy|Strong Buy|Hold|Moderate Sell|Strong Sell)/i.exec(nodeStr);
					if (match && match[1]) {
						data.consensusRating = match[1].trim();
					}
				}
			}

			return data;
		});

		return {
			ticker,
			currentPrice: null, // Removed currentPrice since we don't strictly need it and we don't have it in the new extraction method
			consensusRating: result.consensusRating || 'Unknown',
			consensusTarget: result.consensusTarget,
			upside: result.upside === null ? null : +result.upside.toFixed(2)
		};
	} finally {
		await page.close();
	}
}
