import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';

// Apply stealth plugin to evade detection
puppeteer.use(StealthPlugin());

let browserInstance: Browser | null = null;

/**
 * Initializes and returns a singleton Chromium browser instance using Puppeteer stealth.
 */
export async function getBrowser(): Promise<Browser> {
	if (browserInstance) {
		return browserInstance;
	}

	browserInstance = await puppeteer.launch({
		headless: true,
		args: [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--disable-web-security',
			'--disable-features=IsolateOrigins,site-per-process'
		]
	});

	return browserInstance;
}

/**
 * Closes the browser instance gracefully.
 */
export async function closeBrowser(): Promise<void> {
	if (browserInstance) {
		await browserInstance.close();
		browserInstance = null;
	}
}

/**
 * Helper to random delay to evade simple rate limits.
 */
export async function randomDelay(minMs: number, maxMs: number): Promise<void> {
	const delay = Math.random() * (maxMs - minMs) + minMs;
	return new Promise((resolve) => setTimeout(resolve, delay));
}
